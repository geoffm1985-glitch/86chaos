'use strict';

const { safeText, safeDateKey } = require('./requestOffRuntimeSafety.cjs');

const EVENT_TEXT_FIELDS = ['id', 'type', 'title', 'eventName', 'name', 'label', 'summary', 'time', 'notes', 'addedBy', 'restaurantId', 'workspaceId', 'imageUrl'];

function safeScheduleObjectRows(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(row => row && typeof row === 'object' && !Array.isArray(row));
}

function normalizeScheduleEventRow(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  let row;
  try { row = { ...event }; } catch (_) { return null; }
  for (const field of EVENT_TEXT_FIELDS) row[field] = safeText(event[field], field === 'notes' ? 4000 : 600);
  row.date = safeDateKey(event.date || event.eventDate || event.startDate || event.dateKey || event.scheduleDateKey);
  row.isImportant = event.isImportant === true;
  row.pushReminders = Array.isArray(event.pushReminders) ? event.pushReminders.filter(Boolean) : [];
  return row;
}

function safeScheduleEventRows(value) {
  return safeScheduleObjectRows(value).map(normalizeScheduleEventRow).filter(Boolean);
}

module.exports = { safeScheduleObjectRows, normalizeScheduleEventRow, safeScheduleEventRows };
