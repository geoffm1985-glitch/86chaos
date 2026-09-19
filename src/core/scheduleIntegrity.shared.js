'use strict';

const SCHEDULE_AUDIT_CLASSIFICATIONS = Object.freeze({
  HEALTHY: 'HEALTHY',
  LEGACY_BUT_VALID: 'LEGACY_BUT_VALID',
  AMBIGUOUS: 'AMBIGUOUS',
  ORPHANED: 'ORPHANED',
  MALFORMED: 'MALFORMED',
  DUPLICATE_CANDIDATE: 'DUPLICATE_CANDIDATE',
  UNVERIFIABLE: 'UNVERIFIABLE'
});

const clean = (value = '') => String(value == null ? '' : value).trim();
const lower = (value = '') => clean(value).toLowerCase();
const normalizeName = (value = '') => lower(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeEmail = (value = '') => lower(value);
const normalizeId = (value = '') => lower(value).replace(/[^a-z0-9@._-]+/g, '');

function isCanonicalScheduleDate(value) {
  const text = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isUsableScheduleTime(value) {
  const text = clean(value).toUpperCase();
  if (['OPEN', 'CLOSE', 'CL'].includes(text)) return true;
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|A|P)?$/);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (minute < 0 || minute > 59) return false;
  return match[3] ? hour >= 1 && hour <= 12 : hour >= 0 && hour <= 23;
}

function buildCanonicalScheduleDatePatch(targetDate) {
  const date = clean(targetDate);
  if (!isCanonicalScheduleDate(date)) throw new Error('A valid YYYY-MM-DD schedule date is required.');
  return { date, scheduleDateKey: date, scheduleMonth: date.slice(0, 7) };
}

function buildCanonicalScheduleCreateFields(targetDate, restaurantId = '') {
  const tenantId = clean(restaurantId);
  if (!tenantId) throw new Error('A restaurant/workspace id is required for a new shift.');
  return { ...buildCanonicalScheduleDatePatch(targetDate), restaurantId: tenantId, workspaceId: tenantId };
}

function valuesEqual(left, right) {
  return clean(left) === clean(right);
}

function buildScheduleQuickEditMutation(shift = {}, requestedPatch = {}, options = {}) {
  const patch = requestedPatch && typeof requestedPatch === 'object' && !Array.isArray(requestedPatch) ? requestedPatch : {};
  const candidate = Object.prototype.hasOwnProperty.call(patch, 'date')
    ? { ...patch, ...buildCanonicalScheduleDatePatch(patch.date) }
    : { ...patch };
  const changedFields = Object.keys(candidate).filter(key => !valuesEqual(shift?.[key], candidate[key]));
  if (changedFields.length === 0) return { skipped: true, noChange: true, payload: {}, changedFields: [] };
  const actorId = clean(options.actorId || 'schedule-quick-edit');
  return {
    skipped: false,
    noChange: false,
    changedFields,
    payload: { ...candidate, updatedAt: options.nowIso || new Date().toISOString(), updatedBy: actorId }
  };
}

const SHIFT_DURABLE_ID_FIELDS = ['scheduleUserId', 'employeeId', 'userId', 'rosterUserId', 'authUid', 'assignedUserId', 'accountUserId', 'workspaceMemberId', 'membershipId'];
const PERSON_DURABLE_ID_FIELDS = ['id', 'scheduleUserId', 'employeeId', 'userId', 'rosterUserId', 'uid', 'authUid', 'assignedUserId', 'accountUserId', 'workspaceMemberId', 'membershipId'];
const SHIFT_EMAIL_FIELDS = ['employeeEmail', 'assignedEmail', 'email', 'userEmail'];
const PERSON_EMAIL_FIELDS = ['email', 'employeeEmail', 'assignedEmail', 'userEmail'];
const SHIFT_NAME_FIELDS = ['employeeName', 'assignedName', 'name', 'displayName', 'fullName', 'userName'];
const PERSON_NAME_FIELDS = ['name', 'displayName', 'fullName', 'employeeName', 'assignedName', 'userName'];

const collect = (source, fields, normalizer) => [...new Set(fields.map(field => normalizer(source?.[field])).filter(Boolean))];
const personEvidence = (person = {}) => ({
  ids: collect(person, PERSON_DURABLE_ID_FIELDS, normalizeId),
  emails: collect(person, PERSON_EMAIL_FIELDS, normalizeEmail),
  names: collect(person, PERSON_NAME_FIELDS, normalizeName)
});
const shiftEvidence = (shift = {}) => ({
  ids: collect(shift, SHIFT_DURABLE_ID_FIELDS, normalizeId),
  emails: collect(shift, SHIFT_EMAIL_FIELDS, normalizeEmail),
  names: collect(shift, SHIFT_NAME_FIELDS, normalizeName)
});

function resolveScheduleAuditIdentity(shift = {}, people = [], options = {}) {
  const observed = shiftEvidence(shift);
  const candidates = (people || []).map(person => ({ person, evidence: personEvidence(person) }));
  const idMatches = candidates.filter(row => row.evidence.ids.some(value => observed.ids.includes(value)));
  const emailMatches = candidates.filter(row => row.evidence.emails.some(value => observed.emails.includes(value)));
  const nameMatches = candidates.filter(row => row.evidence.names.some(value => observed.names.includes(value)));
  const strongest = idMatches.length ? idMatches : emailMatches.length ? emailMatches : nameMatches;
  const matchType = idMatches.length ? 'durable-id' : emailMatches.length ? 'email-fallback' : nameMatches.length ? 'full-name-fallback' : 'none';
  const uniqueMatches = [...new Map(strongest.map(row => [clean(row.person?.id || row.person?.uid || row.person?.email || JSON.stringify(row.person)), row.person])).values()];
  const candidateOwner = row => clean(row.person?.userId || row.person?.uid || row.person?.authUid || row.person?.id || row.person?.email);
  const durableOwners = new Set(idMatches.map(candidateOwner).filter(Boolean));
  const corroborationOwners = new Set([...idMatches, ...emailMatches, ...nameMatches].map(candidateOwner).filter(Boolean));
  const conflictingDurableIds = observed.ids.length > 1 && durableOwners.size > 1;
  const contradictoryEvidence = idMatches.length > 0 && corroborationOwners.size > 1;
  const isUnassigned = observed.ids.length === 0 && observed.emails.length === 0 && observed.names.some(name => ['unassigned', 'open', 'open shift'].includes(name));
  const needsSyntheticDisplayIdentity = !isUnassigned && uniqueMatches.length === 0 && observed.ids.length === 0 && observed.emails.length === 0 && observed.names.length > 0;
  const synthetic = uniqueMatches.length === 1 && uniqueMatches[0]?.syntheticScheduleIdentity === true;
  return {
    observed,
    matchType,
    matches: uniqueMatches.map(person => ({
      id: clean(person?.id || person?.uid),
      name: clean(person?.name || person?.displayName || person?.fullName),
      email: clean(person?.email),
      active: person?.isActive !== false,
      historical: person?.historical === true || person?.deleted === true || person?.isDeleted === true,
      synthetic: person?.syntheticScheduleIdentity === true
    })),
    ambiguous: uniqueMatches.length > 1 || conflictingDurableIds || contradictoryEvidence,
    conflictingDurableIds,
    contradictoryEvidence,
    resolved: uniqueMatches.length === 1 && !conflictingDurableIds && !contradictoryEvidence,
    isUnassigned,
    synthetic,
    needsSyntheticDisplayIdentity,
    lookupComplete: options.identityLookupComplete === true
  };
}

function scheduleDuplicateKey(shift = {}, identity = null) {
  const date = clean(shift.date || shift.scheduleDateKey);
  const ids = identity?.observed?.ids || collect(shift, SHIFT_DURABLE_ID_FIELDS, normalizeId);
  const emails = identity?.observed?.emails || collect(shift, SHIFT_EMAIL_FIELDS, normalizeEmail);
  const names = identity?.observed?.names || collect(shift, SHIFT_NAME_FIELDS, normalizeName);
  const owner = ids[0] ? `id:${ids[0]}` : emails[0] ? `email:${emails[0]}` : names[0] ? `name:${names[0]}` : 'open';
  return [clean(shift.restaurantId || shift.workspaceId), date, owner, lower(shift.role), clean(shift.startTime), clean(shift.endTime)].join('|');
}

function classifyScheduleIntegrityRecord(shift = {}, context = {}) {
  const flags = [];
  const addFlag = flag => { if (!flags.includes(flag)) flags.push(flag); };
  const restaurantId = clean(shift.restaurantId);
  const workspaceId = clean(shift.workspaceId);
  const expectedTenant = clean(context.restaurantId);
  const date = clean(shift.date);
  const scheduleDateKey = clean(shift.scheduleDateKey);
  const effectiveDate = date || scheduleDateKey;
  const identity = resolveScheduleAuditIdentity(shift, context.people || [], context);
  const canonicalVisible = context.canonicalVisible === true;
  const rescueVisible = context.rescueVisible === true;

  if (!restaurantId && !workspaceId) addFlag('missing tenant attribution');
  if (!restaurantId) addFlag('missing restaurant/workspace identity');
  if (restaurantId && workspaceId && restaurantId !== workspaceId) addFlag('restaurant/workspace mismatch');
  if (expectedTenant && ((restaurantId && restaurantId !== expectedTenant) || (workspaceId && workspaceId !== expectedTenant))) addFlag('restaurant/workspace mismatch');
  if (!effectiveDate) addFlag('missing date');
  else if (!isCanonicalScheduleDate(effectiveDate)) addFlag('invalid date');
  if (date && scheduleDateKey && date !== scheduleDateKey) addFlag('conflicting date and scheduleDateKey');
  if (isCanonicalScheduleDate(effectiveDate) && clean(shift.scheduleMonth) !== effectiveDate.slice(0, 7)) addFlag('incorrect/missing scheduleMonth');
  if (!scheduleDateKey) addFlag('missing canonical schedule identity');
  if (!date && scheduleDateKey) addFlag('legacy-only date');
  if (rescueVisible) addFlag('rescue-dependent record');
  if (!canonicalVisible && rescueVisible) addFlag('record that canonical reads alone would miss');
  if (shift.rescueProtected === true || shift.protectedMonth === true || shift.rescueMonth) addFlag('protected-month visibility behavior');
  if (identity.ambiguous) addFlag('ambiguous employee resolution');
  if (identity.conflictingDurableIds || identity.contradictoryEvidence) addFlag('conflicting identity aliases');
  const rawIdentityAliases = [...SHIFT_DURABLE_ID_FIELDS, ...SHIFT_EMAIL_FIELDS, ...SHIFT_NAME_FIELDS].map(field => clean(shift[field])).filter(Boolean);
  if (rawIdentityAliases.some((value, index) => rawIdentityAliases.some((other, otherIndex) => otherIndex !== index && value !== other && lower(value) === lower(other)))) addFlag('case-only identity collision');
  if (identity.matchType !== 'durable-id' && identity.resolved) addFlag('legacy-only identity');
  if (identity.synthetic) addFlag('synthetic schedule-only display identity');
  if (identity.needsSyntheticDisplayIdentity) addFlag('synthetic schedule-only display identity');
  if (!identity.lookupComplete) addFlag('incomplete identity lookup');
  if (context.scanComplete !== true) addFlag('incomplete scan');
  if (context.duplicateGroup?.length > 1) addFlag('duplicate candidate');
  const match = identity.matches[0];
  if (match && match.active === false) addFlag('inactive historical employee');
  if (match?.historical) addFlag('deleted/historical employee');
  if (!identity.isUnassigned && !identity.resolved && identity.lookupComplete) addFlag('orphaned employee reference');

  const malformed = flags.some(flag => ['missing date', 'invalid date', 'conflicting date and scheduleDateKey', 'restaurant/workspace mismatch'].includes(flag))
    || !isUsableScheduleTime(shift.startTime) || !isUsableScheduleTime(shift.endTime);
  if (!isUsableScheduleTime(shift.startTime) || !isUsableScheduleTime(shift.endTime)) addFlag('missing or invalid time');
  let classification = SCHEDULE_AUDIT_CLASSIFICATIONS.HEALTHY;
  if (malformed) classification = SCHEDULE_AUDIT_CLASSIFICATIONS.MALFORMED;
  else if (!restaurantId && !workspaceId) classification = SCHEDULE_AUDIT_CLASSIFICATIONS.UNVERIFIABLE;
  else if (!identity.lookupComplete || context.scanComplete !== true) classification = SCHEDULE_AUDIT_CLASSIFICATIONS.UNVERIFIABLE;
  else if (identity.ambiguous) classification = SCHEDULE_AUDIT_CLASSIFICATIONS.AMBIGUOUS;
  else if (!identity.isUnassigned && !identity.resolved) classification = SCHEDULE_AUDIT_CLASSIFICATIONS.ORPHANED;
  else if (context.duplicateGroup?.length > 1) classification = SCHEDULE_AUDIT_CLASSIFICATIONS.DUPLICATE_CANDIDATE;
  else if (flags.some(flag => ['missing canonical schedule identity', 'legacy-only date', 'legacy-only identity', 'rescue-dependent record', 'synthetic schedule-only display identity', 'inactive historical employee', 'deleted/historical employee', 'incorrect/missing scheduleMonth'].includes(flag))) classification = SCHEDULE_AUDIT_CLASSIFICATIONS.LEGACY_BUT_VALID;

  return {
    id: clean(shift.id),
    classification,
    issueFlags: flags,
    evidence: {
      observedTenant: { restaurantId, workspaceId, expectedTenant },
      rawIdentity: Object.fromEntries([...SHIFT_DURABLE_ID_FIELDS, ...SHIFT_EMAIL_FIELDS, ...SHIFT_NAME_FIELDS].filter(field => shift[field] !== undefined).map(field => [field, shift[field]])),
      normalizedIdentity: identity.observed,
      identityMatch: identity,
      employeeStatus: match ? { active: match.active, historical: match.historical, synthetic: match.synthetic } : null,
      rawDates: { date: shift.date ?? null, scheduleDateKey: shift.scheduleDateKey ?? null, scheduleMonth: shift.scheduleMonth ?? null },
      normalizedDate: isCanonicalScheduleDate(effectiveDate) ? effectiveDate : '',
      visibility: { canonical: canonicalVisible, rescue: rescueVisible, protectedMonth: flags.includes('protected-month visibility behavior') },
      duplicateCandidateGroup: context.duplicateGroup || [],
      scanComplete: context.scanComplete === true,
      identityLookupComplete: identity.lookupComplete,
      lookupFailures: context.lookupFailures || []
    }
  };
}

function classifyScheduleIntegrityRecords(records = [], context = {}) {
  const identities = new Map();
  (records || []).forEach(record => {
    const identity = resolveScheduleAuditIdentity(record, context.people || [], context);
    const key = scheduleDuplicateKey(record, identity);
    if (!identities.has(key)) identities.set(key, []);
    identities.get(key).push(clean(record.id));
  });
  return (records || []).map(record => {
    const identity = resolveScheduleAuditIdentity(record, context.people || [], context);
    const sources = Array.isArray(record?._auditSources) ? record._auditSources : [];
    return classifyScheduleIntegrityRecord(record, {
      ...context,
      canonicalVisible: context.canonicalVisible === true || sources.some(source => source.endsWith(':canonical') || source.includes('complete:')),
      rescueVisible: context.rescueVisible === true || sources.some(source => source.endsWith(':rescue')),
      duplicateGroup: identities.get(scheduleDuplicateKey(record, identity)) || []
    });
  });
}

const scheduleIntegrityShared = {
  SCHEDULE_AUDIT_CLASSIFICATIONS,
  isCanonicalScheduleDate,
  isUsableScheduleTime,
  buildCanonicalScheduleDatePatch,
  buildCanonicalScheduleCreateFields,
  buildScheduleQuickEditMutation,
  resolveScheduleAuditIdentity,
  scheduleDuplicateKey,
  classifyScheduleIntegrityRecord,
  classifyScheduleIntegrityRecords
};

(function publishScheduleIntegrity(root) {
  if (!root) return;
  Object.defineProperty(root, '__86ChaosScheduleIntegrityShared', { value: scheduleIntegrityShared, configurable: true, writable: true });
})(typeof globalThis !== 'undefined' ? globalThis : undefined);

if (typeof module !== 'undefined' && module.exports) module.exports = scheduleIntegrityShared;
