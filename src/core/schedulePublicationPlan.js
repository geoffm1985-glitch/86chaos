import { resolveShiftRosterRole, rosterRoleConfigurationRevision } from './rosterRoleIdentity';

const clean = value => String(value || '').trim();
const shiftDate = shift => clean(shift?.scheduleDateKey || shift?.date);
const shiftId = shift => clean(shift?.id || shift?.shiftId || shift?.documentId);
const employeeId = shift => clean(shift?.scheduleUserId || shift?.employeeId || shift?.rosterUserId || shift?.userId || shift?.authUid);
const normalizedTime = value => clean(value).replace(/^([0-9]):/, '0$1:');
const stable = value => Array.isArray(value) ? value.map(stable) : (!value || typeof value !== 'object' ? value : Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])));
const intentionalOpenShift = shift => shift?.isOpenShift === true || shift?.openShift === true || ['open','unassigned-open'].includes(clean(shift?.assignmentType || shift?.assignmentStatus).toLowerCase());

export function buildSchedulePublicationPlan({ restaurantId, period, selectedWeekKeys = [], selectedRoleIds = [], allRoles = true, candidateShifts = [], rosterRoles = [], actor = {} } = {}) {
  const tenant = clean(restaurantId);
  const roleSet = new Set((selectedRoleIds || []).map(clean).filter(Boolean));
  const unresolvedRoles = [];
  const selected = [];
  for (const shift of candidateShifts || []) {
    const id = shiftId(shift);
    const date = shiftDate(shift);
    if (!id || !date || clean(shift.restaurantId || shift.workspaceId || tenant) !== tenant) continue;
    const resolvedRole = resolveShiftRosterRole(shift, rosterRoles);
    if (!resolvedRole.ok) {
      unresolvedRoles.push({ shiftId: id, reason: resolvedRole.reason, legacyName: resolvedRole.legacyName || '' });
      continue;
    }
    if (!allRoles && !roleSet.has(resolvedRole.rosterRoleId)) continue;
    selected.push({
      id,
      date,
      employeeId: employeeId(shift),
      rosterRoleId: resolvedRole.rosterRoleId,
      rosterRoleNameSnapshot: resolvedRole.rosterRoleNameSnapshot,
      migrateRoleIdentity: resolvedRole.migratable,
      expectedRevision: Number(shift.revision || 0),
      expectedUpdatedAt: clean(shift.updatedAt || ''),
      alreadyPublished: shift.isPublished === true && shift.published === true,
    });
  }
  selected.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return {
    restaurantId: tenant,
    period: { start: clean(period?.start), end: clean(period?.end) },
    selectedWeekKeys: [...new Set(selectedWeekKeys.map(clean).filter(Boolean))].sort(),
    selectedRoleIds: allRoles ? [] : [...roleSet].sort(),
    allRoles: Boolean(allRoles),
    roleConfigurationRevision: rosterRoleConfigurationRevision(rosterRoles),
    actor: { uid: clean(actor.uid || actor.id), email: clean(actor.email) },
    candidateShiftIds: selected.map(row => row.id),
    expectedRevisions: Object.fromEntries(selected.map(row => [row.id, { revision: row.expectedRevision, updatedAt: row.expectedUpdatedAt }])),
    affectedEmployeeIds: [...new Set(selected.map(row => row.employeeId).filter(Boolean))].sort(),
    affectedDates: [...new Set(selected.map(row => row.date))].sort(),
    affectedRoleIds: [...new Set(selected.map(row => row.rosterRoleId))].sort(),
    writeCount: selected.filter(row => !row.alreadyPublished || row.migrateRoleIdentity).length,
    verificationCount: selected.length,
    notificationScope: { employeeIds: [...new Set(selected.map(row => row.employeeId).filter(Boolean))].sort() },
    backupScope: { shiftIds: selected.map(row => row.id), dates: [...new Set(selected.map(row => row.date))].sort() },
    shifts: selected,
    unresolvedRoles,
  };
}

export async function digestSchedulePublicationPlan(plan) {
  const canonical = JSON.stringify(stable(plan));
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(canonical);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) hash = Math.imul(hash ^ canonical.charCodeAt(index), 16777619);
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export async function buildConfirmedShiftEvidence({ shift = {}, resolvedRole = {}, desiredEmployeeIdentity = null } = {}) {
  const identityFields = ['scheduleUserId','employeeId','rosterUserId','userId','authUid','accountUserId','assignedUserId'];
  const state = {
    date: clean(shift.date),
    scheduleDateKey: clean(shift.scheduleDateKey),
    employeeIdentity: desiredEmployeeIdentity || Object.fromEntries(identityFields.map(field => [field, clean(shift[field])])),
    employeeName: ['employeeName','assignedName','name','displayName','fullName'].map(field => clean(shift[field])).find(Boolean) || '',
    employeeEmail: ['employeeEmail','assignedEmail','email','userEmail'].map(field => clean(shift[field])).find(Boolean) || '',
    intentionalOpen: intentionalOpenShift(shift),
    rosterRoleId: clean(resolvedRole.rosterRoleId || shift.rosterRoleId),
    rosterRoleNameSnapshot: clean(resolvedRole.rosterRoleNameSnapshot || shift.rosterRoleNameSnapshot || shift.role),
    startTime: normalizedTime(shift.startTime || shift.start),
    endTime: normalizedTime(shift.endTime || shift.end),
    published: Boolean(shift.isPublished === true && shift.published === true),
    publishStatus: clean(shift.publishStatus || shift.status).toLowerCase(),
    revision: Number(shift.revision || 0),
    updatedAt: clean(shift.updatedAt)
  };
  return { id: shiftId(shift), state, contentDigest: await digestSchedulePublicationPlan(state) };
}
