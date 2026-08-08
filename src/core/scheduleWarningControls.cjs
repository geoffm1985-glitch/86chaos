'use strict';

const SUBJECT_ID_FIELDS = ['userId', 'employeeId', 'rosterUserId', 'scheduleUserId', 'authUid', 'uid', 'accountUserId', 'assignedUserId'];
const SUBJECT_NAME_FIELDS = ['employeeName', 'userName', 'name', 'displayName', 'fullName', 'assignedName'];
const SUBJECT_EMAIL_FIELDS = ['employeeEmail', 'userEmail', 'email', 'assignedEmail'];

function cleanText(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeToken(value = '') {
  return cleanText(value).toLowerCase().replace(/^mailto:/, '').replace(/[^a-z0-9@._ -]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function unique(values = []) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function firstNonEmpty(record = {}, fields = []) {
  for (const field of fields) {
    const value = cleanText(record?.[field]);
    if (value) return value;
  }
  return '';
}

function requestSubjectTokens(request = {}) {
  const values = [...SUBJECT_ID_FIELDS, ...SUBJECT_NAME_FIELDS, ...SUBJECT_EMAIL_FIELDS].flatMap(field => {
    const raw = cleanText(request?.[field]);
    if (!raw) return [];
    const normalized = normalizeToken(raw);
    return [raw, normalized, ...normalized.split(/[\s,;]+/)].filter(Boolean);
  });
  return unique(values.map(normalizeToken));
}

function requestSubjectLabel(request = {}) {
  return firstNonEmpty(request, SUBJECT_NAME_FIELDS) || firstNonEmpty(request, SUBJECT_EMAIL_FIELDS) || 'Employee';
}

function requestMatchesEmployeeFilter(request = {}, filter = '') {
  const query = normalizeToken(filter);
  if (!query) return true;
  const terms = query.split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = requestSubjectTokens(request).join(' ');
  return terms.every(term => haystack.includes(term));
}

function scheduleWarningEmployeeLabel(shift = {}, resolvedPerson = null) {
  const resolvedName = cleanText(resolvedPerson?.employeeName || resolvedPerson?.name || resolvedPerson?.displayName || resolvedPerson?.fullName);
  if (resolvedName) return resolvedName;
  const shiftName = firstNonEmpty(shift, ['employeeName', 'assignedName', 'userName', 'name', 'displayName', 'fullName']);
  if (shiftName) return shiftName;
  const shiftEmail = firstNonEmpty(shift, ['employeeEmail', 'assignedEmail', 'userEmail', 'email']);
  if (shiftEmail) return shiftEmail;
  return 'Unresolved employee';
}

function warningShiftContext(shift = {}) {
  const role = cleanText(shift.role || shift.targetRole || 'Unassigned role');
  const start = cleanText(shift.startTime || 'start missing');
  const end = cleanText(shift.endTime || 'end missing');
  return `${start}-${end} • ${role}`;
}

function buildCoverageVarianceRows({ coverageTargets = [], weekDates = [], weekShifts = [], roleMatcher = (a, b) => cleanText(a).toLowerCase() === cleanText(b).toLowerCase(), canonicalRole = role => role } = {}) {
  const rows = [];
  for (const target of coverageTargets || []) {
    const dayIndex = Number.parseInt(target?.dayIndex || 0, 10) || 0;
    const date = weekDates[dayIndex];
    if (!date) continue;
    const role = canonicalRole(target?.role || 'Unassigned');
    const targetCount = Number.parseInt(target?.count || 0, 10) || 0;
    if (targetCount <= 0) continue;
    const existing = (weekShifts || []).filter(shift => (
      shift?.date === date
      && roleMatcher(shift?.role, role)
      && (!target?.startTime || shift?.startTime === target.startTime)
    )).length;
    const delta = existing - targetCount;
    if (delta === 0) continue;
    rows.push({
      ...target,
      id: target?.id || `${dayIndex}-${role}-${target?.startTime || ''}-${target?.endTime || ''}`,
      dayIndex,
      date,
      role,
      originalRole: target?.role,
      count: targetCount,
      target: targetCount,
      existing,
      delta,
      type: delta < 0 ? 'under' : 'over',
      needed: delta < 0 ? Math.abs(delta) : 0,
      over: delta > 0 ? delta : 0,
    });
  }
  return rows;
}

function requestWorkspaceId(request = {}) {
  return cleanText(request.restaurantId || request.workspaceId || request.restaurant || '');
}

function isRequestOffBulkEligible(request = {}, { visibleIds = [], workspaceId = '', canManage = false, normalizeStatus = r => String(r?.status || 'pending').toLowerCase(), isArchivedRequest = r => r?.archived === true || r?.processed === true, requirePending = false } = {}) {
  if (!canManage) return false;
  const visible = new Set(visibleIds || []);
  if (!request?.id || !visible.has(request.id)) return false;
  const requestWorkspace = requestWorkspaceId(request);
  if (!workspaceId || !requestWorkspace || requestWorkspace !== workspaceId) return false;
  if (isArchivedRequest(request)) return false;
  const status = normalizeStatus(request);
  if (requirePending && status !== 'pending') return false;
  return true;
}

module.exports = {
  SUBJECT_ID_FIELDS,
  SUBJECT_NAME_FIELDS,
  SUBJECT_EMAIL_FIELDS,
  cleanText,
  normalizeToken,
  requestSubjectTokens,
  requestSubjectLabel,
  requestMatchesEmployeeFilter,
  scheduleWarningEmployeeLabel,
  warningShiftContext,
  buildCoverageVarianceRows,
  isRequestOffBulkEligible,
};
