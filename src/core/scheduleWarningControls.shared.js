'use strict';

// Shared implementation used by the browser ESM wrapper and the Node CommonJS wrapper.
// Keep Schedule warning business logic in this single file so the two module systems cannot drift.
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

function safeRecordArray(value) {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
}

function asFunction(candidate, fallback) {
  return typeof candidate === 'function' ? candidate : fallback;
}

const defaultRoleMatcher = (a, b) => cleanText(a).toLowerCase() === cleanText(b).toLowerCase();
const defaultCanonicalRole = role => role;
const defaultResolvePerson = () => ({ ok: false, person: null });
const defaultMatchesTimeOff = () => false;
const defaultIsActiveRequest = () => true;
const defaultFingerprintBuilder = (...parts) => parts.map(cleanText).join('|');
const defaultFormatDate = date => cleanText(date);

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

function buildCoverageVarianceRows(options = {}) {
  const safeOptions = options && typeof options === 'object' ? options : {};
  const { coverageTargets = [], weekDates = [], weekShifts = [] } = safeOptions;
  const roleMatcher = asFunction(safeOptions.roleMatcher, defaultRoleMatcher);
  const canonicalRole = asFunction(safeOptions.canonicalRole, defaultCanonicalRole);
  const rows = [];
  const targets = safeRecordArray(coverageTargets);
  const dates = Array.isArray(weekDates) ? weekDates : [];
  const shifts = safeRecordArray(weekShifts);
  for (const target of targets) {
    try {
      const parsedDayIndex = Number.parseInt(target?.dayIndex ?? 0, 10);
      const dayIndex = Number.isFinite(parsedDayIndex) ? parsedDayIndex : 0;
      const date = dates[dayIndex];
      if (!date) continue;
      const role = cleanText(canonicalRole(target?.role || 'Unassigned')) || 'Unassigned';
      const targetCount = Number.parseInt(target?.count || 0, 10) || 0;
      if (targetCount <= 0) continue;
      const existing = shifts.filter(shift => {
        try {
          return shift?.date === date
            && roleMatcher(shift?.role, role)
            && (!target?.startTime || shift?.startTime === target.startTime);
        } catch (_) {
          return false;
        }
      }).length;
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
    } catch (_) {
      // A malformed legacy target must not take down Schedule Builder.
    }
  }
  return rows;
}

function buildScheduleConflictWarningRows(options = {}) {
  const safeOptions = options && typeof options === 'object' ? options : {};
  const { weekStart = '', schedule = [], allUsers = [], requests = [] } = safeOptions;
  const resolvePerson = asFunction(safeOptions.resolvePerson, defaultResolvePerson);
  const matchesTimeOff = asFunction(safeOptions.matchesTimeOff, defaultMatchesTimeOff);
  const isActiveRequest = asFunction(safeOptions.isActiveRequest, defaultIsActiveRequest);
  const employeeLabeler = asFunction(safeOptions.employeeLabeler, scheduleWarningEmployeeLabel);
  const shiftContext = asFunction(safeOptions.shiftContext, warningShiftContext);
  const fingerprintBuilder = asFunction(safeOptions.fingerprintBuilder, defaultFingerprintBuilder);
  const formatDate = asFunction(safeOptions.formatDate, defaultFormatDate);
  const safeSchedule = safeRecordArray(schedule);
  const safeUsers = safeRecordArray(allUsers);
  const safeRequests = safeRecordArray(requests);
  const warnings = [];

  for (const shift of safeSchedule) {
    try {
      let person = null;
      try {
        const resolved = resolvePerson(shift, safeUsers);
        person = resolved?.ok && resolved?.person && typeof resolved.person === 'object' ? resolved.person : null;
      } catch (_) {
        person = null;
      }

      let employeeLabel = 'Unresolved employee';
      try {
        employeeLabel = cleanText(employeeLabeler(shift, person)) || 'Unresolved employee';
      } catch (_) {
        employeeLabel = scheduleWarningEmployeeLabel(shift, person);
      }

      const subject = person || {
        id: shift.employeeId || shift.scheduleUserId || shift.rosterUserId || shift.userId || shift.authUid || '',
        employeeId: shift.employeeId || '',
        scheduleUserId: shift.scheduleUserId || '',
        rosterUserId: shift.rosterUserId || '',
        userId: shift.userId || '',
        authUid: shift.authUid || '',
        name: shift.employeeName || shift.userName || shift.name || '',
        employeeName: shift.employeeName || shift.userName || shift.name || '',
        email: shift.employeeEmail || shift.userEmail || shift.email || '',
        employeeEmail: shift.employeeEmail || shift.userEmail || shift.email || '',
      };

      let off = null;
      for (const request of safeRequests) {
        try {
          if (request?.date !== shift?.date) continue;
          if (!isActiveRequest(request)) continue;
          if (!matchesTimeOff(request, subject)) continue;
          off = request;
          break;
        } catch (_) {
          // Skip only the malformed request and keep evaluating the rest.
        }
      }

      if (off) {
        let fingerprint = '';
        try {
          fingerprint = fingerprintBuilder(
            'schedule-request-off',
            weekStart,
            shift.id || '',
            shift.date || '',
            employeeLabel,
            shift.employeeId || '',
            shift.scheduleUserId || '',
            shift.rosterUserId || '',
            shift.startTime || '',
            shift.endTime || '',
            shift.role || '',
            off.id || ''
          );
        } catch (_) {
          fingerprint = `${weekStart}|${shift.id || shift.date || ''}|${off.id || ''}`;
        }
        let detail = '';
        if (employeeLabel === 'Unresolved employee') {
          try { detail = cleanText(shiftContext(shift)); } catch (_) { detail = warningShiftContext(shift); }
        }
        let displayDate = cleanText(shift.date);
        try { displayDate = formatDate(shift.date) || displayDate; } catch (_) {}
        warnings.push({
          type: 'request-off-conflict',
          alertId: `schedule-${weekStart}-request-off-${shift.id || shift.employeeId || shift.scheduleUserId || shift.date}-${shift.date}`,
          fingerprint,
          message: `${employeeLabel} is scheduled on requested-off date ${displayDate}.`,
          detail,
        });
      }
    } catch (_) {
      // A malformed legacy shift must not take down Schedule Builder.
    }
  }

  for (const user of safeUsers) {
    try {
      const userId = user.id || user.employeeId || user.scheduleUserId || user.rosterUserId || user.userId || '';
      if (!userId) continue;
      const count = safeSchedule.filter(shift => (
        shift?.employeeId === userId
        || shift?.scheduleUserId === userId
        || shift?.rosterUserId === userId
      )).length;
      if (count < 6) continue;
      const userName = cleanText(user.name || user.employeeName || user.displayName || user.email) || 'Employee';
      let fingerprint = '';
      try { fingerprint = fingerprintBuilder('schedule-load', weekStart, userId, userName, count); }
      catch (_) { fingerprint = `${weekStart}|${userId}|${count}`; }
      warnings.push({
        type: 'schedule-load',
        alertId: `schedule-${weekStart}-load-${userId}`,
        fingerprint,
        message: `${userName} has ${count} scheduled days this week.`,
        detail: '',
      });
    } catch (_) {
      // Skip only the malformed roster row.
    }
  }

  const seen = new Set();
  return warnings.filter(warning => {
    const key = `${warning.type}|${warning.message}|${warning.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

function requestWorkspaceId(request = {}) {
  return cleanText(request.restaurantId || request.workspaceId || request.restaurant || '');
}

function isRequestOffBulkEligible(request = {}, { visibleIds = [], workspaceId = '', canManage = false, normalizeStatus = r => String(r?.status || 'pending').toLowerCase(), isArchivedRequest = r => r?.archived === true || r?.processed === true, requirePending = false } = {}) {
  if (!canManage) return false;
  const visible = new Set(visibleIds || []);
  if (!request?.id || !visible.has(request.id)) return false;
  const requestWorkspace = requestWorkspaceId(request);
  if (workspaceId && requestWorkspace && requestWorkspace !== workspaceId) return false;
  if (isArchivedRequest(request)) return false;
  const status = normalizeStatus(request);
  if (requirePending && status !== 'pending') return false;
  return true;
}

const scheduleWarningControlsShared = {
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
  safeRecordArray,
  asFunction,
  buildCoverageVarianceRows,
  buildScheduleConflictWarningRows,
  isRequestOffBulkEligible,
};

(function publishScheduleWarningControls(root) {
  if (!root) return;
  Object.defineProperty(root, '__86ChaosScheduleWarningControlsShared', {
    value: scheduleWarningControlsShared,
    configurable: true,
    writable: true,
  });
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
