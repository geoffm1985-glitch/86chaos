'use strict';

// Pure Schedule Tools period logic shared by the browser and Node tests.
// Dates are parsed at local noon to preserve the Schedule Builder's existing
// local-calendar semantics across month, year, and daylight-saving boundaries.
(function attachScheduleToolsPeriod(root) {
  const WEEKDAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

  const clean = value => String(value ?? '').trim();
  const isDateKey = value => /^\d{4}-\d{2}-\d{2}$/.test(clean(value));
  const normalizeWeekStart = (value = 'Monday') => {
    const candidate = clean(value) || 'Monday';
    return Object.prototype.hasOwnProperty.call(WEEKDAY_INDEX, candidate) ? candidate : 'Monday';
  };
  const toLocalDate = (dateKey) => {
    if (!isDateKey(dateKey)) return null;
    const parsed = new Date(`${dateKey}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    const roundTrip = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    return roundTrip === dateKey ? parsed : null;
  };
  const toDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const addDays = (dateKey, amount) => {
    const date = toLocalDate(dateKey);
    if (!date) return '';
    date.setDate(date.getDate() + Number(amount || 0));
    return toDateKey(date);
  };
  const monthKey = dateKey => clean(dateKey).slice(0, 7);
  const daysInMonth = (value) => {
    const month = monthKey(value);
    if (!/^\d{4}-\d{2}$/.test(month)) return 0;
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(year, monthNumber, 0).getDate();
  };
  const buildDateRange = (start, end, maxDays = 75) => {
    if (!toLocalDate(start) || !toLocalDate(end) || start > end) return [];
    const dates = [];
    let cursor = start;
    while (cursor && cursor <= end && dates.length < maxDays) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return dates;
  };
  const weekStartForDate = (dateKey, weekStartsOn) => {
    const date = toLocalDate(dateKey);
    if (!date) return '';
    const targetDay = WEEKDAY_INDEX[normalizeWeekStart(weekStartsOn)];
    while (date.getDay() !== targetDay) date.setDate(date.getDate() - 1);
    return toDateKey(date);
  };
  const buildWeekSegments = (dates = [], weekStartsOn = 'Monday') => {
    const groups = new Map();
    (Array.isArray(dates) ? dates : []).forEach(dateKey => {
      const key = weekStartForDate(dateKey, weekStartsOn);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(dateKey);
    });
    return Array.from(groups.entries()).map(([key, weekDates]) => ({
      key,
      start: weekDates[0],
      end: weekDates[weekDates.length - 1],
      dates: weekDates
    }));
  };

  function deriveScheduleToolsPeriod({ anchorDate = '', mode = 'monthly', weeks = null, weekStartsOn = 'Monday' } = {}) {
    const anchor = toLocalDate(anchorDate) ? anchorDate : toDateKey(new Date());
    const normalizedMode = ['weekly', 'biweekly', 'monthly', 'custom'].includes(clean(mode).toLowerCase()) ? clean(mode).toLowerCase() : 'monthly';
    const normalizedWeekStart = normalizeWeekStart(weekStartsOn);
    const requestedWeeks = normalizedMode === 'weekly'
      ? 1
      : normalizedMode === 'biweekly'
        ? 2
        : normalizedMode === 'custom'
          ? Math.min(8, Math.max(1, Number.parseInt(weeks, 10) || 1))
          : null;
    let start = '';
    let end = '';
    if (normalizedMode === 'monthly') {
      const month = monthKey(anchor);
      start = `${month}-01`;
      end = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
    } else {
      start = weekStartForDate(anchor, normalizedWeekStart);
      end = addDays(start, (requestedWeeks * 7) - 1);
    }
    const dates = buildDateRange(start, end);
    return {
      mode: normalizedMode,
      weeks: requestedWeeks,
      weekStartsOn: normalizedWeekStart,
      anchorDate: anchor,
      start,
      end,
      dates,
      weekSegments: buildWeekSegments(dates, normalizedWeekStart),
      key: `${normalizedMode}:${start}:${end}`
    };
  }

  function deriveScheduleToolsCopyWeek(period = {}) {
    return deriveScheduleToolsPeriod({
      anchorDate: period.anchorDate || period.start,
      mode: 'weekly',
      weeks: 1,
      weekStartsOn: period.weekStartsOn || 'Monday'
    });
  }

  function scheduleToolsRecordDateKey(record = {}) {
    return clean(record?.date || record?.scheduleDateKey || record?.shiftDate || record?.day || '');
  }

  function filterScheduleToolsRecords(records = [], period = {}, workspaceId = '') {
    const dateSet = new Set(Array.isArray(period?.dates) ? period.dates : []);
    const expectedWorkspace = clean(workspaceId);
    return (Array.isArray(records) ? records : []).filter(record => {
      if (!record || typeof record !== 'object') return false;
      const recordWorkspace = clean(record.restaurantId || record.workspaceId || record.restaurant || '');
      if (expectedWorkspace && recordWorkspace && recordWorkspace !== expectedWorkspace) return false;
      return dateSet.has(scheduleToolsRecordDateKey(record));
    });
  }

  function recurringDatesForWeekday(period = {}, dayIndex = 0) {
    const wanted = Number.parseInt(dayIndex, 10);
    if (!Number.isInteger(wanted) || wanted < 0 || wanted > 6) return [];
    return (Array.isArray(period?.dates) ? period.dates : []).filter(dateKey => toLocalDate(dateKey)?.getDay() === wanted);
  }

  function assessScheduleToolsCompleteness(sources = []) {
    const reasons = [];
    (Array.isArray(sources) ? sources : []).forEach(source => {
      if (!source || source.required === false) return;
      const label = clean(source.label || source.name || 'schedule data');
      if (source.error) reasons.push(`${label} could not be loaded`);
      else if (source.resolved !== true) reasons.push(`${label} is still loading`);
      if (Number(source.limit || 0) > 0 && Number(source.count || 0) >= Number(source.limit)) reasons.push(`${label} reached its retrieval limit`);
      if (source.workspaceId && source.expectedWorkspaceId && clean(source.workspaceId) !== clean(source.expectedWorkspaceId)) reasons.push(`${label} belongs to a different restaurant`);
    });
    return { complete: reasons.length === 0, reasons: Array.from(new Set(reasons)) };
  }

  const api = {
    WEEKDAY_INDEX,
    normalizeWeekStart,
    addDays,
    buildDateRange,
    weekStartForDate,
    deriveScheduleToolsPeriod,
    deriveScheduleToolsCopyWeek,
    scheduleToolsRecordDateKey,
    filterScheduleToolsRecords,
    recurringDatesForWeekday,
    assessScheduleToolsCompleteness
  };
  Object.defineProperty(root, '__86ChaosScheduleToolsPeriodShared', { value: api, configurable: true, writable: true });
})(typeof globalThis !== 'undefined' ? globalThis : this);

