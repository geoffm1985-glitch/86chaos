'use strict';

const DURABLE_ID_FIELDS = [
  'scheduleUserId', 'employeeId', 'rosterUserId', 'userId', 'uid', 'authUid', 'accountUserId',
  'assignedUserId', 'membershipId', 'workspaceMemberId', 'id',
  'accountProfile.id', 'accountProfile.uid', 'accountProfile.authUid', 'accountProfile.userId', 'accountProfile.employeeId'
];
const EMAIL_FIELDS = ['email', 'emailLower', 'employeeEmail', 'userEmail', 'assignedEmail', 'authEmail', 'accountProfile.email', 'accountProfile.emailLower'];
const NAME_FIELDS = ['employeeName', 'assignedName', 'userName', 'name', 'displayName', 'fullName', 'firstName', 'lastName'];
const EXACT_EMPLOYEE_ID_FIELDS = ['employeeId', 'accountProfile.employeeId'];

function getPathValue(record = {}, path = '') {
  return String(path || '').split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), record);
}
function normalizeIdentityValue(value = '') { return String(value ?? '').toLowerCase().trim(); }
function normalizeEmailValue(value = '') { return normalizeIdentityValue(value).replace(/^mailto:/, ''); }
function normalizeNameValue(value = '') {
  return normalizeIdentityValue(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function unique(values = [], normalizer = value => String(value || '')) {
  const seen = new Set();
  const out = [];
  (values || []).forEach(value => {
    const raw = String(value ?? '').trim();
    if (!raw) return;
    const key = normalizer(raw);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(raw);
  });
  return out;
}
function collectNormalizedFieldValues(records = [], fields = [], normalizer = normalizeIdentityValue) {
  const rows = Array.isArray(records) ? records : [records];
  return unique(rows.filter(Boolean).flatMap(record => fields.map(field => normalizer(getPathValue(record, field)))), value => value);
}
function collectExactFieldValues(records = [], fields = []) {
  const rows = Array.isArray(records) ? records : [records];
  return unique(rows.filter(Boolean).flatMap(record => fields.map(field => getPathValue(record, field))), value => String(value || ''));
}
function collectDurableAliases(...records) {
  return collectNormalizedFieldValues(records, DURABLE_ID_FIELDS, normalizeIdentityValue);
}
function collectEmailAliases(...records) {
  return collectNormalizedFieldValues(records, EMAIL_FIELDS, normalizeEmailValue).filter(value => value.includes('@'));
}
function collectNameAliases(...records) {
  const rows = [];
  records.filter(Boolean).forEach(record => {
    NAME_FIELDS.forEach(field => rows.push(normalizeNameValue(getPathValue(record, field))));
    const first = normalizeNameValue(record.firstName || '');
    const last = normalizeNameValue(record.lastName || '');
    if (first && last) rows.push(`${first} ${last}`);
  });
  return unique(rows, value => value);
}
function collectFirstNameAliases(...records) {
  return unique(collectNameAliases(...records).map(name => String(name || '').split(/\s+/)[0] || ''), value => value);
}
function activeRoster(roster = []) {
  return (Array.isArray(roster) ? roster : []).filter(row => row && row.isActive !== false);
}
function personMatchesDurableAliases(person = {}, aliases = []) {
  const set = new Set((aliases || []).map(normalizeIdentityValue));
  return collectDurableAliases(person).some(alias => set.has(alias));
}
function personMatchesEmailAliases(person = {}, aliases = []) {
  const set = new Set((aliases || []).map(normalizeEmailValue));
  return collectEmailAliases(person).some(alias => set.has(alias));
}
function uniqueMatch(matches = [], reason = 'match') {
  return matches.length === 1
    ? { ok: true, person: matches[0], reason }
    : { ok: false, person: null, reason: matches.length > 1 ? `ambiguous-${reason}` : `no-${reason}` };
}
function resolveRosterPersonForUser(user = {}, roster = []) {
  const rows = activeRoster(roster);
  const durableAliases = collectDurableAliases(user, user?.accountProfile || {});
  const emailAliases = collectEmailAliases(user, user?.accountProfile || {});
  const nameAliases = collectNameAliases(user, user?.accountProfile || {});
  const firstAliases = collectFirstNameAliases(user, user?.accountProfile || {});
  if (durableAliases.length) {
    const result = uniqueMatch(rows.filter(person => personMatchesDurableAliases(person, durableAliases)), 'durable-id');
    if (result.ok) return result;
  }
  if (emailAliases.length) {
    const result = uniqueMatch(rows.filter(person => personMatchesEmailAliases(person, emailAliases)), 'email');
    if (result.ok) return result;
  }
  if (nameAliases.length) {
    const result = uniqueMatch(rows.filter(person => collectNameAliases(person).some(name => nameAliases.includes(name))), 'full-name');
    if (result.ok) return result;
  }
  if (!durableAliases.length && !emailAliases.length && firstAliases.length) {
    const result = uniqueMatch(rows.filter(person => collectFirstNameAliases(person).some(first => firstAliases.includes(first))), 'first-name');
    if (result.ok) return result;
  }
  return { ok: false, person: null, reason: 'unresolved-account-schedule-person' };
}
function buildIdentityContext(user = {}, roster = []) {
  const resolved = resolveRosterPersonForUser(user, roster);
  const person = resolved.ok ? resolved.person : {};
  return {
    resolved,
    durableAliases: unique([...collectDurableAliases(user, user?.accountProfile || {}), ...collectDurableAliases(person)], value => value),
    emailAliases: unique([...collectEmailAliases(user, user?.accountProfile || {}), ...collectEmailAliases(person)], value => value),
    nameAliases: unique([...collectNameAliases(user, user?.accountProfile || {}), ...collectNameAliases(person)], value => value),
    firstNameAliases: unique([...collectFirstNameAliases(user, user?.accountProfile || {}), ...collectFirstNameAliases(person)], value => value),
    exactEmployeeIds: collectExactEmployeeIdValues(user, user?.accountProfile || {}, person),
    activeRoster: activeRoster(roster)
  };
}
function shiftMatchesNameSafely(shift = {}, context = {}) {
  const shiftNames = collectNameAliases(shift);
  const shiftFirsts = collectFirstNameAliases(shift);
  if (!shiftNames.length && !shiftFirsts.length) return false;
  const rows = context.activeRoster || [];
  const exactMatches = shiftNames.length ? rows.filter(person => collectNameAliases(person).some(name => shiftNames.includes(name))) : [];
  if (exactMatches.length === 1 && context.resolved?.ok && exactMatches[0] === context.resolved.person) return true;
  if (exactMatches.length > 1) return false;
  if (shiftFirsts.length) {
    const firstMatches = rows.filter(person => collectFirstNameAliases(person).some(first => shiftFirsts.includes(first)));
    if (firstMatches.length === 1 && context.resolved?.ok && firstMatches[0] === context.resolved.person) return true;
  }
  return false;
}
function shiftMatchesMyScheduleIdentity(shift = {}, user = {}, roster = []) {
  const context = buildIdentityContext(user, roster);
  const durableSet = new Set(context.durableAliases.map(normalizeIdentityValue));
  const emailSet = new Set(context.emailAliases.map(normalizeEmailValue));
  const shiftDurable = collectDurableAliases(shift);
  const shiftEmails = collectEmailAliases(shift);
  if (shiftDurable.some(alias => durableSet.has(alias))) return true;
  if (shiftEmails.some(alias => emailSet.has(alias))) return true;
  return shiftMatchesNameSafely(shift, context);
}
function collectExactEmployeeIdValues(...records) {
  return unique(records.filter(Boolean).flatMap(record => collectExactFieldValues(record, EXACT_EMPLOYEE_ID_FIELDS)), value => String(value || ''));
}
function buildRosterIdentityFingerprint(user = {}, roster = []) {
  const relevantUser = {
    durable: collectDurableAliases(user, user?.accountProfile || {}),
    emails: collectEmailAliases(user, user?.accountProfile || {}),
    names: collectNameAliases(user, user?.accountProfile || {}),
    employeeIds: collectExactEmployeeIdValues(user, user?.accountProfile || {})
  };
  const relevantRoster = activeRoster(roster).map(row => ({
    id: String(row?.id || row?.uid || row?.userId || '').trim(),
    isActive: row?.isActive !== false,
    durable: collectDurableAliases(row),
    emails: collectEmailAliases(row),
    names: collectNameAliases(row),
    firsts: collectFirstNameAliases(row),
    employeeIds: collectExactEmployeeIdValues(row)
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify({ user: relevantUser, roster: relevantRoster });
}
function shiftDateInRange(shift = {}, start = '', end = '') {
  const dates = unique([shift.date, shift.scheduleDateKey, shift.shiftDate, shift.day].map(value => String(value || '').slice(0, 10)).filter(Boolean), value => value);
  return dates.some(date => (!start || date >= start) && (!end || date <= end));
}

module.exports = {
  DURABLE_ID_FIELDS,
  EMAIL_FIELDS,
  NAME_FIELDS,
  normalizeIdentityValue,
  normalizeEmailValue,
  normalizeNameValue,
  unique,
  collectDurableAliases,
  collectEmailAliases,
  collectNameAliases,
  collectFirstNameAliases,
  activeRoster,
  resolveRosterPersonForUser,
  buildIdentityContext,
  shiftMatchesMyScheduleIdentity,
  shiftMatchesNameSafely,
  collectExactEmployeeIdValues,
  buildRosterIdentityFingerprint,
  shiftDateInRange
};
