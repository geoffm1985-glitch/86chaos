import { getToday, getMonthStr, formatDate } from './appCore';

const addDays = (dateStr, amount) => {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return formatDate(d);
};
const getMonthBounds = (dateStr) => {
  const [year, month] = getMonthStr(dateStr).split('-').map(Number);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0);
  return { start, end: formatDate(endDate) };
};
const WEEKDAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
const normalizeWeekStart = (value = 'Monday') => Object.prototype.hasOwnProperty.call(WEEKDAY_INDEX, String(value || 'Monday')) ? String(value || 'Monday') : 'Monday';

const normalizeScheduleAliasValue = (value = '') => String(value ?? '').trim().toLowerCase();
const normalizeScheduleEmailValue = (value = '') => normalizeScheduleAliasValue(value).replace(/^mailto:/, '');
const normalizeScheduleNameValue = (value = '') => normalizeScheduleAliasValue(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const titleCaseScheduleName = (value = '') => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .split(' ')
  .filter(Boolean)
  .map(part => part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(' ');
const cleanCanonicalScheduleName = (value = '') => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  if (['unknown', 'unknown staff', 'unknown employee', 'employee unknown', 'unassigned', 'unassigned staff', 'unassigned employee'].includes(lower)) return '';
  const emailLocal = text.includes('@') ? text.split('@')[0] : text;
  const compact = emailLocal.replace(/[_-]+/g, ' ').replace(/\s+/g, '').trim();
  const machine = compact.match(/^([a-z]{2,})([a-z])(\d{2,})$/i);
  if (machine) return titleCaseScheduleName(`${machine[1]} ${machine[2]}`);
  if (text.includes('@') || /^[a-z][a-z0-9._-]*\d{2,}$/i.test(text)) return titleCaseScheduleName(emailLocal.replace(/\d{2,}$/g, ''));
  return text;
};
const uniqueNonEmpty = (values = []) => Array.from(new Set(values.map(v => String(v || '').trim()).filter(Boolean)));

const DURABLE_SCHEDULE_ID_FIELDS = [
  'scheduleUserId', 'employeeId', 'rosterUserId', 'userId', 'authUid', 'uid', 'id',
  'accountUserId', 'assignedUserId', 'membershipId', 'workspaceMemberId',
  'accountProfile.id', 'accountProfile.uid', 'accountProfile.authUid'
];
// Shift document `id` is a Firestore document id, not an employee id.
const DURABLE_SHIFT_EMPLOYEE_ID_FIELDS = [
  'scheduleUserId', 'employeeId', 'rosterUserId', 'userId', 'authUid', 'uid',
  'accountUserId', 'assignedUserId', 'membershipId', 'workspaceMemberId'
];
const SCHEDULE_EMAIL_FIELDS = ['email', 'emailLower', 'employeeEmail', 'userEmail', 'assignedEmail', 'authEmail'];
const SCHEDULE_NAME_FIELDS = ['employeeName', 'assignedName', 'userName', 'name', 'displayName', 'fullName'];

const getPathValue = (record = {}, path = '') => String(path || '').split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), record);

export const collectScheduleDurableIdentityAliases = (...records) => {
  const values = [];
  records.filter(Boolean).forEach(record => {
    DURABLE_SCHEDULE_ID_FIELDS.forEach(field => values.push(normalizeScheduleAliasValue(getPathValue(record, field))));
  });
  return uniqueNonEmpty(values);
};

export const collectScheduleShiftDurableIdentityAliases = (...records) => {
  const values = [];
  records.filter(Boolean).forEach(record => {
    DURABLE_SHIFT_EMPLOYEE_ID_FIELDS.forEach(field => values.push(normalizeScheduleAliasValue(getPathValue(record, field))));
  });
  return uniqueNonEmpty(values);
};

export const collectScheduleEmailAliases = (...records) => {
  const values = [];
  records.filter(Boolean).forEach(record => {
    SCHEDULE_EMAIL_FIELDS.forEach(field => values.push(normalizeScheduleEmailValue(getPathValue(record, field))));
  });
  return uniqueNonEmpty(values).filter(v => v.includes('@'));
};

export const collectScheduleFullNameAliases = (...records) => {
  const values = [];
  records.filter(Boolean).forEach(record => {
    SCHEDULE_NAME_FIELDS.forEach(field => values.push(normalizeScheduleNameValue(getPathValue(record, field))));
  });
  return uniqueNonEmpty(values);
};

export const collectScheduleFirstNameAliases = (...records) => uniqueNonEmpty(
  collectScheduleFullNameAliases(...records).map(name => String(name || '').split(/\s+/)[0] || '')
);

export const collectScheduleIdentityAliases = (...records) => uniqueNonEmpty([
  ...collectScheduleDurableIdentityAliases(...records),
  ...collectScheduleEmailAliases(...records)
]);

export const collectScheduleShiftIdentityAliases = (...records) => uniqueNonEmpty([
  ...collectScheduleShiftDurableIdentityAliases(...records),
  ...collectScheduleEmailAliases(...records)
]);


export const getScheduleShiftDateKeyValue = (shift = {}) => String(
  shift?.date || shift?.scheduleDateKey || shift?.shiftDate || shift?.day || ''
).trim();

export const buildScheduleDateKeyRangeClauses = (clauses = []) => (Array.isArray(clauses) ? clauses : []).map(clause => {
  if (!Array.isArray(clause)) return clause;
  const [field, op, value] = clause;
  return field === 'date' ? ['scheduleDateKey', op, value] : clause;
});

const loadedScheduleShiftMergeKey = (shift = {}) => {
  const id = String(shift?.id || '').trim();
  // Same Firestore shift can arrive from both the legacy date query and the
  // scheduleDateKey rescue query with different field completeness. Merge those
  // copies by document id first, then use the logical key only for id-less
  // legacy/imported rows.
  if (id) return `id:${id}`;
  const dateKey = getScheduleShiftDateKeyValue(shift);
  const employeeKey = [
    shift?.scheduleUserId, shift?.employeeId, shift?.rosterUserId, shift?.userId, shift?.authUid, shift?.uid,
    shift?.accountUserId, shift?.assignedUserId, shift?.membershipId, shift?.workspaceMemberId,
    shift?.employeeEmail, shift?.assignedEmail, shift?.userEmail, shift?.email,
    normalizeScheduleNameValue(shift?.employeeName || shift?.assignedName || shift?.userName || shift?.name || '')
  ].map(value => String(value || '').trim().toLowerCase()).find(Boolean);
  const start = String(shift?.startTime || '').trim().toLowerCase();
  const end = String(shift?.endTime || '').trim().toLowerCase();
  const role = String(shift?.role || shift?.targetRole || '').trim().toLowerCase();
  const restaurantId = String(shift?.restaurantId || shift?.workspaceId || '').trim().toLowerCase();
  const publishState = shift?.isPublished === true || String(shift?.status || '').toLowerCase() === 'published' || String(shift?.publishStatus || '').toLowerCase() === 'published' ? 'published' : 'draft';
  if (restaurantId && dateKey && employeeKey && start && end) return ['logical', restaurantId, dateKey, employeeKey, role, start, end, publishState].join('|');
  return [restaurantId, dateKey, employeeKey, role, start, end, publishState].filter(Boolean).join('|');
};

export const normalizeLoadedScheduleShift = (shift = {}) => {
  const safeShift = shift && typeof shift === 'object' ? shift : {};
  const dateKey = getScheduleShiftDateKeyValue(safeShift);
  if (!dateKey) return safeShift;
  return {
    ...safeShift,
    date: safeShift.date || dateKey,
    scheduleDateKey: safeShift.scheduleDateKey || dateKey,
    scheduleMonth: safeShift.scheduleMonth || dateKey.slice(0, 7)
  };
};

export const mergeLoadedScheduleShifts = (...sources) => {
  const byKey = new Map();
  sources.flat().filter(Boolean).forEach(rawShift => {
    const shift = normalizeLoadedScheduleShift(rawShift);
    const key = loadedScheduleShiftMergeKey(shift);
    if (!key) return;
    const previous = byKey.get(key) || {};
    byKey.set(key, normalizeLoadedScheduleShift({
      ...previous,
      ...shift,
      id: previous.id || shift.id,
      date: previous.date || shift.date,
      scheduleDateKey: previous.scheduleDateKey || shift.scheduleDateKey,
      scheduleMonth: previous.scheduleMonth || shift.scheduleMonth
    }));
  });
  return Array.from(byKey.values());
};

const activeScheduleRoster = (roster = []) => (Array.isArray(roster) ? roster : []).filter(person => person && person.isActive !== false);
const uniqueMatch = (matches = [], reason = 'match') => matches.length === 1
  ? { ok: true, person: matches[0], reason }
  : { ok: false, person: null, reason: matches.length > 1 ? `ambiguous-${reason}` : `no-${reason}` };
const rosterWithDurableAlias = (roster, aliases) => activeScheduleRoster(roster).filter(person => collectScheduleDurableIdentityAliases(person).some(alias => aliases.includes(alias)));
const rosterWithEmailAlias = (roster, aliases) => activeScheduleRoster(roster).filter(person => collectScheduleEmailAliases(person).some(alias => aliases.includes(alias)));
const rosterWithFullNameAlias = (roster, aliases) => activeScheduleRoster(roster).filter(person => collectScheduleFullNameAliases(person).some(alias => aliases.includes(alias)));
const rosterWithFirstNameAlias = (roster, aliases) => activeScheduleRoster(roster).filter(person => collectScheduleFirstNameAliases(person).some(alias => aliases.includes(alias)));

export const resolveSchedulePersonForAccount = (account = {}, roster = []) => {
  const durableAliases = collectScheduleDurableIdentityAliases(account, account?.accountProfile || {});
  const emailAliases = collectScheduleEmailAliases(account, account?.accountProfile || {});
  const fullNameAliases = collectScheduleFullNameAliases(account, account?.accountProfile || {});
  const firstNameAliases = collectScheduleFirstNameAliases(account, account?.accountProfile || {});

  if (durableAliases.length) {
    const result = uniqueMatch(rosterWithDurableAlias(roster, durableAliases), 'durable-id');
    if (result.ok) return result;
  }
  if (emailAliases.length) {
    const result = uniqueMatch(rosterWithEmailAlias(roster, emailAliases), 'email');
    if (result.ok) return result;
  }
  if (fullNameAliases.length) {
    const result = uniqueMatch(rosterWithFullNameAlias(roster, fullNameAliases), 'full-name');
    if (result.ok) return result;
  }
  if (!durableAliases.length && !emailAliases.length && firstNameAliases.length) {
    const result = uniqueMatch(rosterWithFirstNameAlias(roster, firstNameAliases), 'first-name');
    if (result.ok) return result;
  }
  return { ok: false, person: null, reason: 'unresolved-account-schedule-person' };
};

export const resolveSchedulePersonForShift = (shift = {}, roster = []) => {
  const durableAliases = collectScheduleShiftDurableIdentityAliases(shift);
  const emailAliases = collectScheduleEmailAliases(shift);
  const fullNameAliases = collectScheduleFullNameAliases(shift);
  const firstNameAliases = collectScheduleFirstNameAliases(shift);

  if (durableAliases.length) {
    const result = uniqueMatch(rosterWithDurableAlias(roster, durableAliases), 'durable-id');
    if (result.ok) return result;
    // If a restored/imported record kept a stale durable id, exact email or full-name evidence may repair it.
    if (emailAliases.length) {
      const emailResult = uniqueMatch(rosterWithEmailAlias(roster, emailAliases), 'email');
      if (emailResult.ok) return emailResult;
    }
    if (fullNameAliases.length) {
      const nameResult = uniqueMatch(rosterWithFullNameAlias(roster, fullNameAliases), 'full-name');
      if (nameResult.ok) return nameResult;
    }
    return result;
  }
  if (emailAliases.length) return uniqueMatch(rosterWithEmailAlias(roster, emailAliases), 'email');
  if (fullNameAliases.length) {
    const result = uniqueMatch(rosterWithFullNameAlias(roster, fullNameAliases), 'full-name');
    if (result.ok) return result;
  }
  if (firstNameAliases.length) return uniqueMatch(rosterWithFirstNameAlias(roster, firstNameAliases), 'first-name');
  return { ok: false, person: null, reason: 'missing-employee-identity' };
};

export const buildCanonicalScheduleIdentityBlock = (person = {}, evidence = {}) => {
  const safePerson = person && typeof person === 'object' ? person : {};
  const safeEvidence = evidence && typeof evidence === 'object' ? evidence : {};
  const scheduleUserId = safePerson.scheduleUserId || safePerson.employeeId || safePerson.rosterUserId || safePerson.id || safePerson.membershipId || safePerson.workspaceMemberId || safeEvidence.scheduleUserId || safeEvidence.employeeId || safeEvidence.rosterUserId || '';
  const employeeId = safePerson.employeeId || safePerson.id || safePerson.scheduleUserId || safePerson.rosterUserId || scheduleUserId || safeEvidence.employeeId || '';
  const rosterUserId = safePerson.rosterUserId || safePerson.id || safePerson.scheduleUserId || safePerson.employeeId || scheduleUserId || safeEvidence.rosterUserId || '';
  const accountUserId = safePerson.accountUserId || safePerson.userId || safePerson.authUid || safePerson.uid || safeEvidence.accountUserId || safeEvidence.userId || '';
  const authUid = safePerson.authUid || safePerson.uid || safeEvidence.authUid || safeEvidence.uid || accountUserId || '';
  const userId = safePerson.userId || accountUserId || authUid || safeEvidence.userId || scheduleUserId || '';
  const assignedUserId = safePerson.assignedUserId || scheduleUserId || employeeId || rosterUserId || userId || '';
  const email = safePerson.employeeEmail || safePerson.email || safePerson.userEmail || safeEvidence.employeeEmail || safeEvidence.assignedEmail || safeEvidence.email || '';
  const name = cleanCanonicalScheduleName(safePerson.employeeName || safePerson.name || safePerson.displayName || safePerson.fullName)
    || cleanCanonicalScheduleName(safeEvidence.employeeName || safeEvidence.assignedName || safeEvidence.name || safeEvidence.displayName)
    || cleanCanonicalScheduleName(email)
    || 'Unknown';
  return { scheduleUserId, employeeId, rosterUserId, userId, authUid, accountUserId, assignedUserId, employeeName: name, assignedName: name, employeeEmail: email, assignedEmail: email };
};

export const scheduleIdentityBlockMatchesPerson = (shift = {}, person = {}) => {
  const desired = buildCanonicalScheduleIdentityBlock(person, shift);
  const idFields = ['scheduleUserId', 'employeeId', 'rosterUserId', 'userId', 'authUid', 'assignedUserId'];
  const missingRequired = ['scheduleUserId', 'employeeId', 'rosterUserId', 'employeeName', 'assignedName'].some(field => !String(shift?.[field] || '').trim());
  if (missingRequired) return false;
  const mismatchedIds = idFields.some(field => {
    const wanted = normalizeScheduleAliasValue(desired[field]);
    const actual = normalizeScheduleAliasValue(shift?.[field]);
    return wanted && actual && wanted !== actual;
  });
  if (mismatchedIds) return false;
  const desiredEmail = normalizeScheduleEmailValue(desired.employeeEmail || desired.assignedEmail || '');
  const actualEmail = normalizeScheduleEmailValue(shift?.employeeEmail || shift?.assignedEmail || shift?.email || '');
  if (desiredEmail && actualEmail && desiredEmail !== actualEmail) return false;
  return true;
};

const getOuterScheduleWeekBounds = (bounds, appUser = {}) => {
  const startKey = bounds?.start || getToday();
  const endKey = bounds?.end || startKey;
  const weekStartIndex = WEEKDAY_INDEX[normalizeWeekStart(appUser?.systemSettings?.scheduleWeekStartsOn || appUser?.systemSettings?.weekStartsOn || appUser?.preferences?.payPeriodStart || 'Monday')] ?? 1;
  const start = new Date(`${startKey}T12:00:00`);
  while (start.getDay() !== weekStartIndex) start.setDate(start.getDate() - 1);
  const end = new Date(`${endKey}T12:00:00`);
  while (end.getDay() !== ((weekStartIndex + 6) % 7)) end.setDate(end.getDate() + 1);
  return { start: formatDate(start), end: formatDate(end) };
};
export const getCanonicalScheduleUserId = (user = {}) => {
  const safeUser = user && typeof user === 'object' ? user : {};
  return safeUser.scheduleUserId || safeUser.employeeId || safeUser.rosterUserId || safeUser.membershipId || safeUser.workspaceMemberId || safeUser.userId || safeUser.authUid || safeUser.uid || safeUser.id || '';
}; // email is migration evidence only, not a durable query ID
export const canManageScheduleForPlanner = (user = {}) => Boolean(user?.isSuperAdmin || user?.isAdmin || user?.isOwner || user?.accountOwner || user?.workspaceOwner || user?.permissions?.schedule || user?.permissions?.team);

export function buildScheduleQueryPlan({ activeTabState = '', activeScheduleSubTab = 'my-schedule', appUser = {}, currentDate = getToday(), selectedMonth = '', visibleRange = null, wantsToday = false, messageRangeStart = '' } = {}) {
  const safeAppUser = appUser && typeof appUser === 'object' ? appUser : {};
  const today = getToday();
  const monthBounds = getMonthBounds(selectedMonth || currentDate);
  const scheduleWindowStart = visibleRange?.start || addDays(monthBounds.start, -14);
  const scheduleWindowEnd = visibleRange?.end || addDays(monthBounds.end, 60);
  const recentWindowStart = addDays(today, -30);
  const futureWindowEnd = addDays(today, 14);
  const todayOpsWindowEnd = addDays(today, 7);
  const isScheduleRoute = ['schedule', 'published', 'events'].includes(activeTabState);
  const scheduleUserId = getCanonicalScheduleUserId(safeAppUser);
  const authUserId = safeAppUser.authUid || safeAppUser.uid || safeAppUser.userId || safeAppUser.id || '';
  const canManageSchedule = canManageScheduleForPlanner(safeAppUser);
  const ownUserClause = scheduleUserId ? [['scheduleUserId', '==', scheduleUserId]] : [['scheduleUserId', '==', '__none__']];
  const plan = {
    shiftClauses: [['date','>=', today], ['date','<=', todayOpsWindowEnd]],
    shiftsEnabled: true,
    shiftLimit: 80,
    timeOffEnabled: true,
    timeOffClauses: authUserId ? [['userId', '==', authUserId]] : [['userId', '==', '__none__']],
    timeOffLimit: 40,
    timeOffHistoryEnabled: false,
    timeOffHistoryClauses: [],
    timeOffHistoryLimit: 40,
    eventsEnabled: wantsToday,
    eventEnabled: wantsToday,
    eventClauses: [['date', '>=', messageRangeStart || recentWindowStart], ['date', '<=', todayOpsWindowEnd]],
    eventLimit: 35,
    swapsEnabled: false,
    swapOrderByField: 'shiftDate',
    swapClauses: [['status', 'in', ['available','open']], ['shiftDate','>=', today]],
    swapLimit: 30,
    availabilityEnabled: false,
    needsAvailability: false,
    availabilityClauses: [],
    needsTemplates: false,
    needsCoverageTargets: false,
    needsRoles: false,
    needsRoster: false,
    canManageSchedule,
    activePunchClauses: scheduleUserId ? [['scheduleUserId','==', scheduleUserId], ['status','in',['clocked_in','on_break']]] : [['scheduleUserId','==','__none__']],
    activePunchLimit: 1
  };
  if (!isScheduleRoute) return plan;

  if (activeTabState === 'events') {
    return { ...plan, shiftsEnabled: false, shiftClauses: [], shiftLimit: 0, timeOffEnabled: false, timeOffClauses: [], timeOffLimit: 0, swapsEnabled: false, availabilityEnabled: false, eventEnabled: true, eventsEnabled: true, eventClauses: [['date','>=', monthBounds.start], ['date','<=', monthBounds.end]], eventLimit: 180, needsAvailability: false, needsTemplates: false, needsCoverageTargets: false, needsRoles: false, needsRoster: false };
  }

  if (activeScheduleSubTab === 'schedule-builder') {
    return { ...plan, shiftClauses: [['date','>=', scheduleWindowStart], ['date','<=', scheduleWindowEnd]], shiftLimit: 420, timeOffClauses: [['date','>=', scheduleWindowStart], ['date','<=', scheduleWindowEnd]], timeOffLimit: 180, eventEnabled: true, eventsEnabled: true, eventClauses: [['date','>=', scheduleWindowStart], ['date','<=', scheduleWindowEnd]], eventLimit: 500, availabilityEnabled: true, needsAvailability: true, availabilityClauses: [['date','>=', scheduleWindowStart], ['date','<=', scheduleWindowEnd]], needsTemplates: true, needsCoverageTargets: true, needsRoles: true, needsRoster: true };
  }
  if (['full-schedule','month-view'].includes(activeScheduleSubTab)) {
    return { ...plan, shiftClauses: [['date','>=', monthBounds.start], ['date','<=', monthBounds.end]], shiftLimit: 500, timeOffClauses: canManageSchedule ? [['date','>=', monthBounds.start], ['date','<=', monthBounds.end]] : (authUserId ? [['userId','==',authUserId], ['date','>=', monthBounds.start], ['date','<=', monthBounds.end]] : [['userId','==','__none__']]), timeOffLimit: canManageSchedule ? 120 : 40, eventEnabled: true, eventsEnabled: true, eventClauses: [['date','>=', monthBounds.start], ['date','<=', monthBounds.end]], eventLimit: 120, needsRoster: canManageSchedule };
  }
  if (activeScheduleSubTab === 'time-off') {
    const activeStatuses = ['pending', 'approved'];
    const terminalStatuses = ['denied', 'rejected', 'cancelled', 'canceled', 'processed', 'completed', 'archived'];
    return {
      ...plan,
      shiftClauses: canManageSchedule ? [['date','>=', recentWindowStart], ['date','<=', scheduleWindowEnd]] : [...ownUserClause, ['date','>=', recentWindowStart], ['date','<=', scheduleWindowEnd]],
      shiftLimit: canManageSchedule ? 250 : 80,
      // Managers need the Request Off workflow to load the visible date window even when
      // the stricter status+date composite listener is unavailable or still building in QA.
      // TabTimeOff already applies the status/date/employee filters client-side.
      timeOffClauses: canManageSchedule
        ? [['date','>=', recentWindowStart], ['date','<=', scheduleWindowEnd]]
        : (authUserId ? [['userId','==',authUserId], ['status','in',activeStatuses], ['date','>=', recentWindowStart]] : [['userId','==','__none__']]),
      timeOffLimit: canManageSchedule ? 220 : 60,
      timeOffHistoryEnabled: true,
      timeOffHistoryClauses: canManageSchedule
        ? [['status','in',terminalStatuses]]
        : (authUserId ? [['userId','==',authUserId], ['status','in',terminalStatuses]] : [['userId','==','__none__']]),
      timeOffHistoryLimit: 40,
      eventEnabled: false,
      needsRoster: canManageSchedule
    };
  }
  if (activeScheduleSubTab === 'availability') {
    return { ...plan, shiftClauses: canManageSchedule ? [['date','>=', recentWindowStart], ['date','<=', futureWindowEnd]] : [...ownUserClause, ['date','>=', recentWindowStart], ['date','<=', futureWindowEnd]], shiftLimit: 80, timeOffClauses: authUserId ? [['userId','==',authUserId], ['date','>=', recentWindowStart], ['date','<=', futureWindowEnd]] : [['userId','==','__none__']], timeOffLimit: 30, eventEnabled: false, eventsEnabled: false, availabilityEnabled: true, needsAvailability: true, availabilityClauses: canManageSchedule ? [] : (scheduleUserId ? [['scheduleUserId','==', scheduleUserId]] : [['scheduleUserId','==','__none__']]), needsRoster: canManageSchedule };
  }
  if (activeScheduleSubTab === 'trade-board') {
    return { ...plan, shiftClauses: canManageSchedule ? [['date','>=', today], ['date','<=', futureWindowEnd]] : [...ownUserClause, ['date','>=', today], ['date','<=', scheduleWindowEnd]], shiftLimit: canManageSchedule ? 180 : 60, timeOffClauses: authUserId ? [['userId','==',authUserId], ['date','>=', recentWindowStart], ['date','<=', futureWindowEnd]] : [['userId','==','__none__']], timeOffLimit: 30, swapsEnabled: true, swapClauses: canManageSchedule ? [['status','in',['available','open']], ['shiftDate','>=', today]] : [['requesterUserId','==', authUserId || '__none__'], ['shiftDate','>=', today]], swapLimit: 80, eventEnabled: false, needsRoster: true };
  }
  // My Schedule must not hide restored/imported legacy shifts that have employeeId,
  // rosterUserId, email, or name but do not yet have scheduleUserId. Load the
  // selected schedule month plus the full outer pay-period weeks. That way a
  // published August Week 1 can include late-July shifts and still resolve the
  // employee-facing schedule correctly after partial publishing.
  const myScheduleBounds = getOuterScheduleWeekBounds(monthBounds, safeAppUser);
  return { ...plan, shiftClauses: [['date','>=', myScheduleBounds.start], ['date','<=', myScheduleBounds.end]], shiftLimit: 420, timeOffClauses: authUserId ? [['userId','==', authUserId], ['date','>=', myScheduleBounds.start], ['date','<=', myScheduleBounds.end]] : [['userId','==','__none__']], timeOffLimit: 80, swapsEnabled: true, swapClauses: authUserId ? [['requesterUserId','==', authUserId], ['shiftDate','>=', today]] : [['status','in',['available','open']]], swapLimit: 40, eventEnabled: false, needsRoster: true };
}
