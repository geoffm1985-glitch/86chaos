const DATE_FIELDS = ['date','requestDate','requestedDate','startDate','dateKey','day','requestedDay','scheduleDateKey','scheduleDayKey'];
const TEXT_FIELDS = [
  'id','restaurantId','workspaceId','tenantId','clientId','userId','employeeId','rosterUserId','accountUserId','scheduleUserId','uid','authUid',
  'ghostTargetUserId','targetUserId','requestedForUserId','userEmail','employeeEmail','email','assignedEmail','userName','employeeName','name','displayName',
  'role','scheduleRole','primaryRole','startTime','endTime','status','previousStatus','requestedByName','approvedByName','deniedByName','publishedByName','archivedByName','cancelledByName','canceledByName',
  'requestedBy','createdBy','updatedBy','approvedBy','deniedBy','publishedBy','archivedBy','cancelledBy','canceledBy','restoredBy','scheduleId','source'
];
const INSTANT_FIELDS = ['requestedAt','submittedAt','createdAt','updatedAt','requestTimestamp','approvedAt','deniedAt','cancelledAt','canceledAt','archivedAt','publishedAt'];

const safeText = (value, max = 500) => {
  try {
    if (value === null || value === undefined || typeof value === 'object') return '';
    return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  } catch (error) {
    return '';
  }
};

const timestampDate = (value) => {
  try {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value?.toDate === 'function') {
      const converted = value.toDate();
      return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
    }
    if (typeof value === 'object') {
      const seconds = Number(value.seconds ?? value._seconds);
      const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
      if (!Number.isFinite(seconds)) return null;
      const converted = new Date((seconds * 1000) + (Number.isFinite(nanoseconds) ? Math.floor(nanoseconds / 1e6) : 0));
      return Number.isNaN(converted.getTime()) ? null : converted;
    }
    const text = safeText(value, 120);
    if (!text) return null;
    const converted = new Date(text);
    return Number.isNaN(converted.getTime()) ? null : converted;
  } catch (error) {
    return null;
  }
};

const safeDateKey = (value) => {
  const direct = safeText(value, 40);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const converted = timestampDate(value);
  return converted ? converted.toISOString().slice(0, 10) : '';
};

export const requestOffDateKey = (request = {}) => {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return '';
  for (const field of DATE_FIELDS) {
    const key = safeDateKey(request[field]);
    if (key) return key;
  }
  return '';
};

const safeInstant = (value) => {
  const direct = safeText(value, 120);
  if (direct && !/^\[object Object\]$/i.test(direct)) {
    const converted = new Date(direct);
    return Number.isNaN(converted.getTime()) ? direct : converted.toISOString();
  }
  const converted = timestampDate(value);
  return converted ? converted.toISOString() : '';
};

export const normalizeRequestOffRuntimeRow = (request) => {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return null;
  let row;
  try {
    row = { ...request };
  } catch (error) {
    return null;
  }
  for (const field of TEXT_FIELDS) row[field] = safeText(request[field], field === 'id' ? 220 : 500);
  for (const field of INSTANT_FIELDS) row[field] = safeInstant(request[field]);
  row.date = requestOffDateKey(request);
  row.isPartial = request.isPartial === true;
  row.archived = request.archived === true;
  row.processed = request.processed === true;
  row.unresolvedPublishedOverlap = request.unresolvedPublishedOverlap === true;
  row.overlapsPublishedSchedule = request.overlapsPublishedSchedule === true;
  return row;
};

export const safeRequestOffRows = (...lists) => {
  const rows = [];
  for (const list of lists) {
    if (Array.isArray(list)) rows.push(...list);
    else if (list && typeof list === 'object') rows.push(list);
  }
  return rows.map(normalizeRequestOffRuntimeRow).filter(Boolean);
};

export default { requestOffDateKey, normalizeRequestOffRuntimeRow, safeRequestOffRows };
