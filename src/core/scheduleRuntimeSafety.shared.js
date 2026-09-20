'use strict';

const { safeText, safeDateKey, safeInstant } = require('./requestOffRuntimeSafety.shared.js');

const EVENT_TEXT_FIELDS = ['id', 'type', 'title', 'eventName', 'name', 'label', 'summary', 'time', 'notes', 'addedBy', 'restaurantId', 'workspaceId', 'imageUrl'];
const ROSTER_TEXT_FIELDS = ['id','uid','authUid','accountUserId','userId','employeeId','rosterUserId','scheduleUserId','membershipId','workspaceMemberId','restaurantId','workspaceId','email','employeeEmail','name','displayName','fullName','employeeName','assignedName','role','scheduleRole','primaryRole','photoURL'];
const SHIFT_TEXT_FIELDS = ['id','restaurantId','workspaceId','date','scheduleDateKey','employeeId','userId','rosterUserId','scheduleUserId','authUid','employeeEmail','email','employeeName','assignedName','name','role','targetRole','startTime','endTime','status','publishStatus','recordStatus','source','sourceKey'];
const AVAILABILITY_TEXT_FIELDS = ['id','restaurantId','workspaceId','scheduleUserId','employeeId','userId','rosterUserId','authUid','employeeEmail','email','employeeName','userName','name','status','previousStatus','effectiveStartDate','effectiveEndDate','notes','createdBy','createdByName','approvedBy','approvedByName','deniedBy','deniedByName','restoredBy'];
const AVAILABILITY_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function safeScheduleObjectRows(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(row => row && typeof row === 'object' && !Array.isArray(row));
}

function normalizeScheduleRosterRow(person) {
  if (!person || typeof person !== 'object' || Array.isArray(person)) return null;
  let row;
  try { row = { ...person }; } catch (_) { return null; }
  for (const field of ROSTER_TEXT_FIELDS) row[field] = safeText(person[field], field === 'photoURL' ? 1200 : 500);
  const fallbackName = row.name || row.displayName || row.fullName || row.employeeName || row.employeeEmail || row.email || 'Unknown';
  row.name = fallbackName;
  row.displayName = row.displayName || fallbackName;
  row.fullName = row.fullName || fallbackName;
  row.employeeName = row.employeeName || fallbackName;
  row.role = row.role || row.scheduleRole || row.primaryRole || 'Unassigned';
  row.scheduleRole = row.scheduleRole || row.role;
  row.primaryRole = row.primaryRole || row.role;
  row.isActive = person.isActive !== false;
  row.permissions = person.permissions && typeof person.permissions === 'object' && !Array.isArray(person.permissions) ? person.permissions : {};
  row.preferences = person.preferences && typeof person.preferences === 'object' && !Array.isArray(person.preferences) ? person.preferences : {};
  row.systemSettings = person.systemSettings && typeof person.systemSettings === 'object' && !Array.isArray(person.systemSettings) ? person.systemSettings : {};
  return row;
}

function safeScheduleRosterRows(value) {
  return safeScheduleObjectRows(value).map(normalizeScheduleRosterRow).filter(Boolean);
}

function normalizeScheduleShiftRow(shift) {
  if (!shift || typeof shift !== 'object' || Array.isArray(shift)) return null;
  let row;
  try { row = { ...shift }; } catch (_) { return null; }
  for (const field of SHIFT_TEXT_FIELDS) row[field] = safeText(shift[field], 600);
  row.date = safeDateKey(shift.date || shift.scheduleDateKey || shift.shiftDate || shift.dateKey);
  row.scheduleDateKey = row.scheduleDateKey || row.date;
  row.role = row.role || row.targetRole || 'Unassigned';
  row.employeeName = row.employeeName || row.assignedName || row.name || '';
  return row;
}

function safeScheduleShiftRows(value) {
  return safeScheduleObjectRows(value).map(normalizeScheduleShiftRow).filter(Boolean);
}

function normalizeAvailabilityWindow(window) {
  if (!window || typeof window !== 'object' || Array.isArray(window)) return null;
  return {
    ...window,
    day: safeText(window.day, 40),
    start: safeText(window.start || window.startTime, 20),
    end: safeText(window.end || window.endTime, 20),
    startTime: safeText(window.startTime || window.start, 20),
    endTime: safeText(window.endTime || window.end, 20),
    type: safeText(window.type, 40),
  };
}

function normalizeScheduleAvailabilityRow(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  let row;
  try { row = { ...record }; } catch (_) { return null; }
  for (const field of AVAILABILITY_TEXT_FIELDS) row[field] = safeText(record[field], field === 'notes' ? 4000 : 600);
  row.effectiveStartDate = safeDateKey(record.effectiveStartDate || record.startDate);
  row.effectiveEndDate = safeDateKey(record.effectiveEndDate || record.endDate);
  row.createdAt = safeInstant(record.createdAt);
  row.updatedAt = safeInstant(record.updatedAt);
  row.approvedAt = safeInstant(record.approvedAt);
  row.deniedAt = safeInstant(record.deniedAt);
  row.archivedAt = safeInstant(record.archivedAt);
  row.restoredAt = safeInstant(record.restoredAt);
  row.status = row.status || 'pending';
  row.employeeName = row.employeeName || row.userName || row.name || row.employeeEmail || row.email || 'Employee';
  row.archived = record.archived === true;
  row.approvalRequired = record.approvalRequired === true;
  const weekly = record.weeklyAvailability && typeof record.weeklyAvailability === 'object' && !Array.isArray(record.weeklyAvailability) ? record.weeklyAvailability : {};
  row.weeklyAvailability = {};
  for (const day of AVAILABILITY_DAYS) {
    const raw = weekly[day] || weekly[day.toLowerCase()] || null;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    row.weeklyAvailability[day] = {
      available: raw.available !== false,
      preferred: raw.preferred === true,
      start: safeText(raw.start || raw.startTime, 20),
      end: safeText(raw.end || raw.endTime, 20),
      startTime: safeText(raw.startTime || raw.start, 20),
      endTime: safeText(raw.endTime || raw.end, 20),
    };
  }
  row.unavailableWindows = Array.isArray(record.unavailableWindows) ? record.unavailableWindows.map(normalizeAvailabilityWindow).filter(Boolean) : [];
  row.preferredWindows = Array.isArray(record.preferredWindows) ? record.preferredWindows.map(normalizeAvailabilityWindow).filter(Boolean) : [];
  row.preferredDaysOff = Array.isArray(record.preferredDaysOff) ? record.preferredDaysOff.map(v => safeText(v, 40)).filter(Boolean) : [];
  const maxHours = Number(record.maxHoursPerWeek);
  const maxShifts = Number(record.maxShiftsPerWeek);
  row.maxHoursPerWeek = Number.isFinite(maxHours) ? maxHours : null;
  row.maxShiftsPerWeek = Number.isFinite(maxShifts) ? maxShifts : null;
  return row;
}

function safeScheduleAvailabilityRows(value) {
  return safeScheduleObjectRows(value).map(normalizeScheduleAvailabilityRow).filter(Boolean);
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

module.exports = { safeScheduleObjectRows, normalizeScheduleRosterRow, safeScheduleRosterRows, normalizeScheduleShiftRow, safeScheduleShiftRows, normalizeScheduleAvailabilityRow, safeScheduleAvailabilityRows, normalizeScheduleEventRow, safeScheduleEventRows };
