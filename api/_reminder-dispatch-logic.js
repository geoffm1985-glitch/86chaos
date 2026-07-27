'use strict';

const TERMINAL_REMINDER_STATUSES = new Set(['sent', 'done', 'completed', 'dismissed', 'archived', 'cancelled', 'canceled']);
const RETRYABLE_REMINDER_STATUSES = new Set(['scheduled', 'no_push_token', 'delivery_problem', 'dispatching']);

function normalizeToken(token) {
  return String(token || '').trim();
}

function hasModernPushDeviceRegistry(user = {}) {
  return Boolean(user.pushDevices && typeof user.pushDevices === 'object' && Object.keys(user.pushDevices).length > 0);
}

function isActivePushDevice(device = {}, now = Date.now(), maxAgeDays = Number(process.env.PUSH_DEVICE_MAX_AGE_DAYS || 45)) {
  if (!device || typeof device !== 'object') return false;
  const permission = String(device.permission || device.notificationPermission || '').toLowerCase();
  if (device.active === false || device.disabled === true || permission !== 'granted') return false;
  const lastVerified = new Date(device.lastVerifiedAt || device.fcmTokenUpdatedAt || device.updatedAt || 0).getTime();
  const maxAgeMs = Math.max(1, Number(maxAgeDays) || 45) * 24 * 60 * 60 * 1000;
  return !lastVerified || now - lastVerified <= maxAgeMs;
}

function collectLegacyTokens(user = {}) {
  const tokens = new Set();
  const primary = normalizeToken(user.fcmToken);
  if (primary) tokens.add(primary);
  if (Array.isArray(user.fcmTokens)) user.fcmTokens.forEach(value => {
    const token = normalizeToken(value);
    if (token) tokens.add(token);
  });
  if (Array.isArray(user.pushTokens)) user.pushTokens.forEach(value => {
    const token = normalizeToken(typeof value === 'string' ? value : value?.token || value?.fcmToken);
    if (token) tokens.add(token);
  });
  return [...tokens];
}

function collectEligibleTokens(user = {}, now = Date.now()) {
  const tokens = new Set();
  if (hasModernPushDeviceRegistry(user)) {
    Object.values(user.pushDevices || {}).forEach(device => {
      const token = normalizeToken(device?.token || device?.fcmToken);
      if (token && isActivePushDevice(device, now)) tokens.add(token);
    });
    // Once a modern registry exists, legacy arrays are intentionally ignored.
    return [...tokens];
  }
  collectLegacyTokens(user).forEach(token => tokens.add(token));
  return [...tokens];
}

function occurrenceKeyForReminder(docId, dueAt) {
  return `${String(docId || '')}:${String(dueAt || '')}`;
}

function isTerminalReminderStatus(status) {
  return TERMINAL_REMINDER_STATUSES.has(String(status || '').toLowerCase());
}

function isRetryableReminderStatus(status) {
  return RETRYABLE_REMINDER_STATUSES.has(String(status || 'scheduled').toLowerCase());
}

function getZonedParts(date, timeZone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === '24' ? '0' : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second || 0)
  };
}

function zonedLocalToUtcIso(parts, timeZone = 'UTC') {
  // Iterate because the first offset estimate can land on the opposite side of a DST boundary.
  let utc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0, 0);
  for (let i = 0; i < 4; i += 1) {
    const actual = getZonedParts(new Date(utc), timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second || 0, 0);
    const desiredAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0, 0);
    const adjustment = desiredAsUtc - actualAsUtc;
    if (!adjustment) break;
    utc += adjustment;
  }
  return new Date(utc).toISOString();
}

function daysInMonth(year, monthOneBased) {
  return new Date(Date.UTC(year, monthOneBased, 0)).getUTCDate();
}

function addLocalCalendar(parts, recurrence, anchorDay = parts.day) {
  const mode = String(recurrence || '').toLowerCase();
  if (mode === 'daily' || mode === 'weekly') {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0));
    date.setUTCDate(date.getUTCDate() + (mode === 'daily' ? 1 : 7));
    return { ...parts, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  }
  if (mode === 'monthly') {
    const targetMonthIndex = (parts.month - 1) + 1;
    const year = parts.year + Math.floor(targetMonthIndex / 12);
    const monthIndex = ((targetMonthIndex % 12) + 12) % 12;
    const month = monthIndex + 1;
    return { ...parts, year, month, day: Math.min(Number(anchorDay || parts.day), daysInMonth(year, month)) };
  }
  return { ...parts };
}

function getNextRecurringReminderAt(scheduledAt, recurrence, reminder = {}, nowMs = Date.now()) {
  const mode = String(recurrence || 'none').toLowerCase();
  if (!['daily', 'weekly', 'monthly'].includes(mode)) return '';
  const timeZone = reminder.timezone || reminder.timeZone || reminder.reminderTimezone || 'UTC';
  const base = new Date(scheduledAt || reminder.occurrenceScheduledAt || nowMs);
  if (Number.isNaN(base.getTime())) return '';
  let parts = getZonedParts(base, timeZone);
  const clock = String(reminder.localScheduledClockTime || reminder.localClockTime || '').match(/^(\d{1,2}):(\d{2})/);
  if (clock) {
    parts.hour = Number(clock[1]);
    parts.minute = Number(clock[2]);
    parts.second = 0;
  }
  const anchorDay = Number(reminder.recurrenceAnchorDay || reminder.localScheduledDay || parts.day);
  let next = addLocalCalendar(parts, mode, anchorDay);
  let nextIso = zonedLocalToUtcIso(next, timeZone);
  let guard = 0;
  while (new Date(nextIso).getTime() <= nowMs && guard < 500) {
    next = addLocalCalendar(next, mode, anchorDay);
    nextIso = zonedLocalToUtcIso(next, timeZone);
    guard += 1;
  }
  return nextIso;
}

function buildRecurringSuccessUpdate({ docId, reminder = {}, deliveredOccurrenceKey, nextScheduledAt, nowIso, successCount = 0, failureCount = 0 }) {
  const nextOccurrenceKey = occurrenceKeyForReminder(docId, nextScheduledAt);
  return {
    status: 'scheduled',
    occurrenceScheduledAt: nextScheduledAt,
    recurrenceAnchorAt: reminder.recurrenceAnchorAt || reminder.occurrenceScheduledAt || reminder.scheduledAt || nextScheduledAt,
    recurrenceAnchorDay: reminder.recurrenceAnchorDay || getZonedParts(new Date(reminder.recurrenceAnchorAt || reminder.occurrenceScheduledAt || reminder.scheduledAt || nextScheduledAt), reminder.timezone || reminder.timeZone || reminder.reminderTimezone || 'UTC').day,
    nextOccurrenceAt: nextScheduledAt,
    scheduledAt: nextScheduledAt,
    dispatchEligible: true,
    nextDispatchAt: nextScheduledAt,
    dispatchLeaseUntil: null,
    dispatchAttemptAt: null,
    lastDispatchedAt: nowIso,
    lastSuccessfulDispatchAt: nowIso,
    dispatchedAt: null,
    terminalAt: null,
    previousDispatchKey: deliveredOccurrenceKey,
    lastSuccessfulOccurrenceKey: deliveredOccurrenceKey,
    currentOccurrenceKey: nextOccurrenceKey,
    dispatchKey: nextOccurrenceKey,
    pushSuccessCount: successCount,
    pushFailureCount: failureCount,
    dispatchError: null,
    deliveryProblemAt: null,
    updatedAt: nowIso
  };
}

function buildRetryUpdate({ reminder = {}, occurrenceKey, occurrenceAt, nowIso, retryIso, status = 'delivery_problem', error = '', failureCount = 0 }) {
  return {
    status,
    occurrenceScheduledAt: occurrenceAt || reminder.occurrenceScheduledAt || reminder.scheduledAt || nowIso,
    currentOccurrenceKey: occurrenceKey,
    dispatchKey: occurrenceKey,
    dispatchAttemptAt: nowIso,
    lastDispatchAttemptAt: nowIso,
    dispatchLeaseUntil: null,
    dispatchEligible: true,
    nextDispatchAt: retryIso,
    dispatchedAt: null,
    pushFailureCount: failureCount,
    dispatchError: error || null,
    deliveryProblemAt: status === 'delivery_problem' ? nowIso : null,
    updatedAt: nowIso
  };
}

function isRecipientSnapshotFresh(reminder = {}, now = Date.now(), maxAgeHours = Number(process.env.EVENT_REMINDER_SNAPSHOT_MAX_AGE_HOURS || 24)) {
  const rows = Array.isArray(reminder.recipientDeviceSnapshot) ? reminder.recipientDeviceSnapshot : [];
  if (!rows.length) return false;
  const createdAt = new Date(reminder.recipientSnapshotAt || reminder.recipientDeviceSnapshotAt || 0).getTime();
  if (!createdAt) return false;
  return now - createdAt <= Math.max(1, Number(maxAgeHours) || 24) * 60 * 60 * 1000;
}

module.exports = {
  TERMINAL_REMINDER_STATUSES,
  RETRYABLE_REMINDER_STATUSES,
  normalizeToken,
  hasModernPushDeviceRegistry,
  isActivePushDevice,
  collectLegacyTokens,
  collectEligibleTokens,
  occurrenceKeyForReminder,
  isTerminalReminderStatus,
  isRetryableReminderStatus,
  getZonedParts,
  zonedLocalToUtcIso,
  addLocalCalendar,
  getNextRecurringReminderAt,
  buildRecurringSuccessUpdate,
  buildRetryUpdate,
  isRecipientSnapshotFresh
};
