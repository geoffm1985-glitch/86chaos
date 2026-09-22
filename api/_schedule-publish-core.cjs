'use strict';
const crypto = require('node:crypto');

const clean = value => String(value || '').trim();
const nameKey = value => clean(value).replace(/\s+/g, ' ').toLowerCase();
const inactive = value => value?.isActive === false || value?.disabled === true || value?.archived === true || Boolean(value?.archivedAt) || ['inactive','revoked','disabled','deleted','archived','removed'].includes(clean(value?.status).toLowerCase());
const shiftDate = shift => clean(shift?.scheduleDateKey || shift?.date);
const shiftEmployeeId = shift => clean(shift?.scheduleUserId || shift?.employeeId || shift?.rosterUserId || shift?.userId || shift?.authUid);
const employeeIdFields = ['scheduleUserId','employeeId','rosterUserId','userId','authUid','accountUserId','assignedUserId'];
const employeeNameFields = ['employeeName','assignedName','name','displayName','fullName'];
const employeeEmailFields = ['employeeEmail','assignedEmail','email','userEmail'];

const { normalizeRosterRole: normalizeRole, resolveShiftRosterRole: resolveRole } = require('../src/core/rosterRoleIdentityCore.cjs');
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function normalizedTime(value) { return clean(value).replace(/^([0-9]):/, '0$1:'); }
function canonicalEmployeeIdentity(person = {}, evidence = {}) {
  const first = fields => fields.map(field => clean(person[field] || evidence[field])).find(Boolean) || '';
  const scheduleUserId = first(['scheduleUserId','employeeId','rosterUserId','id','membershipId','workspaceMemberId']);
  const employeeId = first(['employeeId','id','scheduleUserId','rosterUserId']) || scheduleUserId;
  const rosterUserId = first(['rosterUserId','id','scheduleUserId','employeeId']) || scheduleUserId;
  const accountUserId = first(['accountUserId','userId','authUid','uid']);
  const authUid = first(['authUid','uid']) || accountUserId;
  const userId = first(['userId']) || accountUserId || authUid || scheduleUserId;
  const assignedUserId = first(['assignedUserId']) || scheduleUserId || employeeId || rosterUserId || userId;
  const email = employeeEmailFields.map(field=>clean(person[field]||evidence[field])).find(Boolean)||'';
  const name = employeeNameFields.map(field=>clean(person[field]||evidence[field])).find(Boolean)||email||'Unknown';
  return { scheduleUserId,employeeId,rosterUserId,userId,authUid,accountUserId,assignedUserId,employeeName:name,assignedName:name,employeeEmail:email,assignedEmail:email };
}
function identityMatches(shift = {}, desired = {}) {
  for (const field of ['scheduleUserId','employeeId','rosterUserId','userId','authUid','assignedUserId']) {
    const wanted=clean(desired[field]), actual=clean(shift[field]);
    if (wanted && (!actual || actual!==wanted)) return false;
  }
  const wantedEmail=clean(desired.employeeEmail).toLowerCase(), actualEmail=clean(shift.employeeEmail||shift.assignedEmail||shift.email).toLowerCase();
  return !wantedEmail || !actualEmail || wantedEmail===actualEmail;
}
function intentionalOpenShift(shift = {}) { return shift.isOpenShift===true || shift.openShift===true || ['open','unassigned-open'].includes(clean(shift.assignmentType||shift.assignmentStatus).toLowerCase()); }
function publicationFieldsValid(shift = {}) { return shift.isPublished===true && shift.published===true && clean(shift.status).toLowerCase()==='published' && clean(shift.publishStatus).toLowerCase()==='published' && Boolean(clean(shift.scheduleId)); }
function canonicalShiftState(shift = {}, resolvedRole = null, employee = null) {
  const roleId=clean(resolvedRole?.rosterRoleId||shift.rosterRoleId);
  const roleName=clean(resolvedRole?.rosterRoleNameSnapshot||shift.rosterRoleNameSnapshot||shift.role);
  const state={
    date:clean(shift.date),
    scheduleDateKey:clean(shift.scheduleDateKey),
    employeeIdentity:employee ? canonicalEmployeeIdentity(employee,shift) : Object.fromEntries(employeeIdFields.map(field=>[field,clean(shift[field])])),
    employeeName:employeeNameFields.map(field=>clean(shift[field])).find(Boolean)||'',
    employeeEmail:employeeEmailFields.map(field=>clean(shift[field])).find(Boolean)||'',
    intentionalOpen:intentionalOpenShift(shift),
    rosterRoleId:roleId,
    rosterRoleNameSnapshot:roleName,
    startTime:normalizedTime(shift.startTime||shift.start),
    endTime:normalizedTime(shift.endTime||shift.end),
    published:Boolean(shift.isPublished===true&&shift.published===true),
    publishStatus:clean(shift.publishStatus||shift.status).toLowerCase(),
    revision:Number(shift.revision||0),
    updatedAt:clean(shift.updatedAt)
  };
  return state;
}
function expectedFingerprint(shift = {}, resolvedRole = null, employee = null) { const state=canonicalShiftState(shift,resolvedRole,employee);return{...state,contentDigest:digest(state)}; }
function fingerprintsMatch(current = {}, expected = {}, resolvedRole = null, employee = null) {
  const actual=expectedFingerprint(current,resolvedRole,employee);
  return Boolean(expected?.contentDigest)&&actual.contentDigest===expected.contentDigest;
}

function buildCanonicalServerPlan({ restaurantId, operationId, dayKeys = [], selectedWeekKeys = [], selectedRoleIds = [], allRoles = true, roles = [], shifts = [], expectedShifts = [], roleConfigurationRevision:confirmedRoleRevision='', roleConfigurationGeneration = 0, actor = {} } = {}) {
  const tenant = clean(restaurantId);
  const days = [...new Set(dayKeys.map(clean).filter(Boolean))].sort();
  const daySet = new Set(days);
  const selectedSet = new Set(selectedRoleIds.map(clean).filter(Boolean));
  const roleMap = new Map(roles.map(normalizeRole).filter(role => role.id).map(role => [role.id, role]));
  if (!allRoles) {
    for (const id of selectedSet) {
      const role = roleMap.get(id);
      if (!role || role.archived) throw Object.assign(new Error('A selected roster role is unavailable or archived.'), { statusCode:409, code:'role_configuration_changed' });
    }
  }
  const roleRows = roles.map(normalizeRole).filter(role=>role.id).sort((a,b)=>a.id.localeCompare(b.id)).map(role=>`${role.id}:${role.revision}:${role.archived?1:0}:${nameKey(role.name)}:${role.previousNames.map(nameKey).sort().join(',')}`).join('|');
  const roleConfigurationRevision = `roles-v1|${roleRows || 'empty'}`;
  if (clean(confirmedRoleRevision) !== roleConfigurationRevision) throw Object.assign(new Error('Roster-role configuration changed after confirmation. Refresh before publishing.'), { statusCode:409, code:'role_configuration_changed' });
  const unresolvedRoles = [];
  const unresolvedEmployees = [];
  const unchangedShiftIds = [];
  const unchangedEvidenceById = new Map();
  const candidates = [];
  for (const raw of shifts) {
    const id = clean(raw.id);
    const date = shiftDate(raw);
    const shiftTenant = clean(raw.restaurantId || raw.workspaceId);
    if (!id || !daySet.has(date) || shiftTenant !== tenant || raw.deleted === true || clean(raw.status).toLowerCase() === 'deleted') continue;
    const role = resolveRole(raw, roles);
    if (!role.ok) { unresolvedRoles.push({ shiftId:id, reason:role.reason, legacyName:role.legacyName || '' }); continue; }
    if (!allRoles && !selectedSet.has(role.rosterRoleId)) continue;
    const employeeResolution=raw._employeeResolution||null;
    const isOpen=intentionalOpenShift(raw);
    if (!isOpen && (!employeeResolution || employeeResolution.ok!==true || !employeeResolution.person)) { unresolvedEmployees.push({shiftId:id,reason:employeeResolution?.reason||'unresolved-employee-reference'});continue; }
    const employee=isOpen?null:employeeResolution.person;
    const desiredIdentity=employee?canonicalEmployeeIdentity(employee,raw):{};
    const needsWrite=!publicationFieldsValid(raw)||role.migratable||clean(raw.rosterRoleId)!==role.rosterRoleId||(employee&&!identityMatches(raw,desiredIdentity))||clean(raw.date)!==date||clean(raw.scheduleDateKey)!==date;
    const currentEvidence = expectedFingerprint(raw,role,employee);
    if(!needsWrite){unchangedShiftIds.push(id);unchangedEvidenceById.set(id,{expected:currentEvidence});continue;}
    candidates.push({ id, date, employeeId:isOpen?'':clean(desiredIdentity.scheduleUserId||shiftEmployeeId(raw)), intentionalOpen:isOpen, desiredEmployeeIdentity:desiredIdentity, rosterRoleId:role.rosterRoleId, rosterRoleNameSnapshot:role.rosterRoleNameSnapshot, migrateRoleIdentity:role.migratable, expected:currentEvidence, alreadyPublished:raw.isPublished === true && raw.published === true });
  }
  candidates.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const expected = [...expectedShifts].map(row => {const state=row.state&&typeof row.state==='object'?stable(row.state):null;return { id:clean(row.id), contentDigest:clean(row.contentDigest)||(state?digest(state):''), state };}).filter(row=>row.id).sort((a,b)=>a.id.localeCompare(b.id));
  const actualIds = candidates.map(row=>row.id).sort((a,b)=>a.localeCompare(b));
  const expectedIds = expected.map(row=>row.id);
  const expectedById = new Map(expected.map(row=>[row.id,row]));
  if (unresolvedRoles.length) throw Object.assign(new Error('One or more shifts have unresolved roster-role identity and require review.'), { statusCode:409, code:'unresolved_role_identity', details:unresolvedRoles });
  const missingEvidenceIds = actualIds.filter(id=>!expectedById.has(id));
  const extraEvidenceIds = expectedIds.filter(id=>!actualIds.includes(id));
  const unavailableEvidenceIds = extraEvidenceIds.filter(id=>!unchangedEvidenceById.has(id));
  if (missingEvidenceIds.length) throw Object.assign(new Error('The saved schedule changed or the candidate query is incomplete. Refresh before publishing.'), { statusCode:409, code:'candidate_set_changed', details:{ actualIds, expectedIds, missingEvidenceIds, unavailableEvidenceIds } });
  const assertConfirmedEvidenceMatches = (id, currentExpected) => {
    const confirmed=expectedById.get(id);
    const serverState=stable(Object.fromEntries(Object.entries(currentExpected).filter(([key])=>key!=='contentDigest')));
    if(!confirmed?.contentDigest||confirmed.contentDigest!==currentExpected.contentDigest||!confirmed.state||JSON.stringify(confirmed.state)!==JSON.stringify(serverState)) throw Object.assign(new Error('A confirmed shift changed before publication.'),{statusCode:409,code:'confirmed_shift_changed',details:{shiftId:id}});
  };
  for (const candidate of candidates) assertConfirmedEvidenceMatches(candidate.id, candidate.expected);
  for (const id of extraEvidenceIds) { const unchanged=unchangedEvidenceById.get(id); if (unchanged) assertConfirmedEvidenceMatches(id, unchanged.expected); }
  const digestInput = { restaurantId:tenant, operationId:clean(operationId), dayKeys:days, selectedWeekKeys:[...new Set(selectedWeekKeys.map(clean).filter(Boolean))].sort(), selectedRoleIds:allRoles?[]:[...selectedSet].sort(), allRoles:Boolean(allRoles), roleConfigurationRevision, roleConfigurationGeneration:Number(roleConfigurationGeneration||0), shifts:candidates.map(row=>({id:row.id,contentDigest:row.expected.contentDigest,desiredEmployeeIdentity:row.desiredEmployeeIdentity,rosterRoleId:row.rosterRoleId,date:row.date})) };
  return {
    ...digestInput,
    planDigest:digest(digestInput),
    candidates,
    unchangedShiftIds:unchangedShiftIds.sort(),
    unresolvedEmployees,
    affectedEmployeeIds:[...new Set(candidates.map(row=>row.employeeId).filter(Boolean))].sort(),
    affectedDates:[...new Set(candidates.map(row=>row.date))].sort(),
    affectedRoleIds:[...new Set(candidates.map(row=>row.rosterRoleId))].sort(),
    writeCount:candidates.filter(row=>!row.alreadyPublished || row.migrateRoleIdentity).length,
    verificationCount:candidates.length,
    actor:{ uid:clean(actor.uid), email:clean(actor.email) },
  };
}

module.exports = { clean, inactive, shiftDate, shiftEmployeeId, normalizeRole, resolveRole, stable, digest, normalizedTime, canonicalEmployeeIdentity, identityMatches, intentionalOpenShift, publicationFieldsValid, canonicalShiftState, expectedFingerprint, fingerprintsMatch, buildCanonicalServerPlan };
