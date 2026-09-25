'use strict';

const DATE_FIELDS = ['date','requestDate','requestedDate','startDate','dateKey','day','requestedDay','scheduleDateKey','scheduleDayKey'];
const TEXT_FIELDS = [
  'id','restaurantId','workspaceId','tenantId','clientId','userId','employeeId','rosterUserId','accountUserId','scheduleUserId','uid','authUid',
  'ghostTargetUserId','targetUserId','requestedForUserId','userEmail','employeeEmail','email','assignedEmail','userName','employeeName','name','displayName',
  'role','scheduleRole','primaryRole','startTime','endTime','status','previousStatus','requestedByName','approvedByName','deniedByName','publishedByName','archivedByName','cancelledByName','canceledByName',
  'requestedBy','createdBy','updatedBy','approvedBy','deniedBy','publishedBy','archivedBy','cancelledBy','canceledBy','restoredBy','scheduleId','source'
];
const INSTANT_FIELDS = ['requestedAt','submittedAt','createdAt','updatedAt','requestTimestamp','approvedAt','deniedAt','cancelledAt','canceledAt','archivedAt','publishedAt'];

function safeText(value, max = 500) {
  try {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return '';
    return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  } catch (_) { return ''; }
}

function timestampDate(value) {
  try {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value?.toDate === 'function') {
      const d=value.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
    if (typeof value === 'object') {
      const seconds = Number(value.seconds ?? value._seconds);
      const nanos = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
      if (Number.isFinite(seconds)) {
        const d = new Date((seconds * 1000) + (Number.isFinite(nanos) ? Math.floor(nanos / 1e6) : 0));
        return Number.isNaN(d.getTime()) ? null : d;
      }
      return null;
    }
    const text=safeText(value,120);
    if (!text) return null;
    const d=new Date(text);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch (_) { return null; }
}

function safeDateKey(value) {
  const direct=safeText(value,40);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const d=timestampDate(value);
  return d ? d.toISOString().slice(0,10) : '';
}

function requestOffDateKey(request = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return '';
  for (const field of DATE_FIELDS) {
    const key=safeDateKey(request[field]);
    if (key) return key;
  }
  return '';
}

function safeInstant(value) {
  const direct=safeText(value,120);
  if (direct && !/^\[object Object\]$/i.test(direct)) {
    const d=new Date(direct);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return direct;
  }
  const d=timestampDate(value);
  return d ? d.toISOString() : '';
}

function normalizeRequestOffRuntimeRow(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return null;
  let row;
  try { row={...request}; } catch (_) { return null; }
  for (const field of TEXT_FIELDS) row[field]=safeText(request[field], field === 'id' ? 220 : 500);
  for (const field of INSTANT_FIELDS) row[field]=safeInstant(request[field]);
  const date=requestOffDateKey(request);
  row.date=date;
  row.isPartial=request.isPartial === true;
  row.archived=request.archived === true;
  row.processed=request.processed === true;
  row.unresolvedPublishedOverlap=request.unresolvedPublishedOverlap === true;
  row.overlapsPublishedSchedule=request.overlapsPublishedSchedule === true;
  return row;
}

function safeRequestOffRows(...lists) {
  const rows=[];
  for (const list of lists) {
    if (Array.isArray(list)) rows.push(...list);
    else if (list && typeof list === 'object') rows.push(list);
  }
  return rows.map(normalizeRequestOffRuntimeRow).filter(Boolean);
}

module.exports={ safeText, timestampDate, safeDateKey, requestOffDateKey, safeInstant, normalizeRequestOffRuntimeRow, safeRequestOffRows };
