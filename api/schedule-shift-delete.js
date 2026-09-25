'use strict';

const { initAdmin, authorize, requireAppCheckIfEnforced, writeAudit, clean } = require('./_chaos-admin');
const { getShiftDate } = require('./schedule-restore-utils');

const MAX_BODY_BYTES = 512 * 1024;
const TENANT_FIELDS = ['restaurantId', 'workspaceId', 'tenantId'];
const PERSON_DURABLE_FIELDS = [
  'employeeId', 'userId', 'uid', 'authUid', 'accountUserId', 'rosterUserId', 'scheduleUserId', 'assignedUserId',
  'workspaceMemberId', 'membershipId', 'employeeEmail', 'userEmail', 'email', 'assignedEmail'
];
const PERSON_NAME_FIELDS = ['employeeName', 'userName', 'name', 'displayName', 'fullName', 'assignedName'];

function parseBody(req) {
  if (String(req.headers?.['content-encoding'] || 'identity').toLowerCase() !== 'identity') {
    throw Object.assign(new Error('Compressed requests are not accepted.'), { statusCode: 415, code: 'invalid_request' });
  }
  const bytes = Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
  if (Number(req.headers?.['content-length'] || 0) > MAX_BODY_BYTES || bytes > MAX_BODY_BYTES) {
    throw Object.assign(new Error('Request is too large.'), { statusCode: 413, code: 'payload_too_large' });
  }
  if (!req.body) return {};
  if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  try { return JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body); }
  catch (_) { throw Object.assign(new Error('Malformed JSON.'), { statusCode: 400, code: 'invalid_request' }); }
}

function canManageSchedule(ctx = {}) {
  const user = ctx.user || {};
  const permissions = ctx.permissions || {};
  return Boolean(
    ctx.isSuperAdmin || user.isAdmin === true || user.isOwner === true || user.accountOwner === true ||
    user.workspaceOwner === true || permissions.schedule === true
  );
}

function normalizeIdentity(value = '') {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9@.]+/g, '');
}
function normalizeName(value = '') {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
}
function tenantKeys(shift = {}) {
  return new Set(TENANT_FIELDS.map(field => clean(shift?.[field])).filter(Boolean));
}
function shiftTenantId(shift = {}) {
  return clean(shift.restaurantId || shift.workspaceId || shift.tenantId || '');
}
function shiftMatchesTenant(shift = {}, restaurantId = '') {
  const expected = clean(restaurantId);
  return Boolean(expected && tenantKeys(shift).has(expected));
}
function shiftDateKey(shift = {}) {
  return clean(getShiftDate(shift) || shift.date || shift.scheduleDateKey || shift.scheduleDate || '');
}
function shiftBelongsToMonth(shift = {}, targetMonth = '') {
  const month = clean(targetMonth).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return false;
  const date = shiftDateKey(shift);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date.slice(0, 7) === month;
  return [shift.scheduleMonth, shift.month, shift.sourceMonth, shift.restoreMonth]
    .some(value => String(value || '').slice(0, 7) === month);
}

function clockMinutes(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  let match = raw.match(/^(\d{1,2}):(\d{2})(?:\s*([ap])\.?m?\.?)?$/i);
  if (!match) match = raw.match(/^(\d{1,2})\s*([ap])\.?m?\.?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] && /^\d{2}$/.test(match[2]) ? match[2] : 0);
  const ampm = (match[3] || (match[2] && !/^\d{2}$/.test(match[2]) ? match[2] : '') || '').toLowerCase();
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = 0;
    if (ampm === 'p') hour += 12;
  } else if (hour < 0 || hour > 23) return null;
  return hour * 60 + minute;
}
function timeKey(value = '') {
  const minutes = clockMinutes(value);
  return minutes === null ? normalizeIdentity(value) : `m${minutes}`;
}

function personDurableKeys(record = {}) {
  const keys = new Set();
  for (const field of PERSON_DURABLE_FIELDS) {
    const value = normalizeIdentity(record?.[field]);
    if (value) keys.add(value);
  }
  return keys;
}
function personNameKeys(record = {}) {
  const keys = new Set();
  for (const field of PERSON_NAME_FIELDS) {
    const value = normalizeName(record?.[field]);
    if (value) keys.add(value);
  }
  return keys;
}
function intersects(a = new Set(), b = new Set()) {
  for (const value of a) if (b.has(value)) return true;
  return false;
}
function sameSchedulePerson(a = {}, b = {}) {
  const aDurable = personDurableKeys(a);
  const bDurable = personDurableKeys(b);
  if (aDurable.size && bDurable.size) return intersects(aDurable, bDurable);
  if (aDurable.size || bDurable.size) {
    const aNames = personNameKeys(a);
    const bNames = personNameKeys(b);
    return aNames.size > 0 && bNames.size > 0 && intersects(aNames, bNames);
  }
  const aNames = personNameKeys(a);
  const bNames = personNameKeys(b);
  return aNames.size > 0 && bNames.size > 0 && intersects(aNames, bNames);
}
function sameLogicalShift(candidate = {}, target = {}) {
  const targetTenants = tenantKeys(target);
  const candidateTenants = tenantKeys(candidate);
  if (targetTenants.size && candidateTenants.size && !intersects(targetTenants, candidateTenants)) return false;
  if (shiftDateKey(candidate) !== shiftDateKey(target)) return false;
  if (timeKey(candidate.startTime) !== timeKey(target.startTime)) return false;
  if (timeKey(candidate.endTime) !== timeKey(target.endTime)) return false;
  return sameSchedulePerson(candidate, target);
}

function rowFromDoc(docSnap) {
  return { id: String(docSnap.id || ''), ...(docSnap.data ? docSnap.data() : {}) };
}
async function loadTenantShiftDocs(db, restaurantId) {
  const byId = new Map();
  const shifts = db.collection('shifts');
  // Canonical + legacy tenant aliases are independent Firestore queries. Run them
  // together so deletion latency is one query round-trip instead of three serial ones.
  const snapshots = await Promise.all(TENANT_FIELDS.map(field => shifts.where(field, '==', restaurantId).get()));
  for (const snap of snapshots) {
    for (const docSnap of snap.docs || []) {
      const row = rowFromDoc(docSnap);
      // The query itself proves one tenant alias matches. Keep the row even when
      // another legacy alias is stale or contradictory so cleanup can repair it.
      if (shiftMatchesTenant(row, restaurantId)) byId.set(row.id, row);
    }
  }
  return Array.from(byId.values());
}

async function deleteRows(db, rows = []) {
  const ids = [...new Set((rows || []).map(row => clean(row?.id)).filter(Boolean))];
  let deletedCount = 0;
  for (let start = 0; start < ids.length; start += 400) {
    const batch = db.batch();
    const chunk = ids.slice(start, start + 400);
    for (const id of chunk) batch.delete(db.collection('shifts').doc(id));
    await batch.commit();
    deletedCount += chunk.length;
  }
  return deletedCount;
}

async function previewMonth(db, restaurantId, month) {
  const rows = await loadTenantShiftDocs(db, restaurantId);
  const matches = rows.filter(row => shiftBelongsToMonth(row, month));
  return { rows: matches, count: matches.length };
}

async function clearMonth(db, restaurantId, month) {
  // A successful Firestore batch commit is authoritative for every document in
  // the snapshot. Avoid repeatedly rescanning the whole tenant after a commit;
  // that made clearing a normal month feel dramatically slower than the write.
  const preview = await previewMonth(db, restaurantId, month);
  const initialCount = preview.count;
  const deletedCount = await deleteRows(db, preview.rows);
  return { initialCount, deletedCount, remainingCount: 0 };
}

function expectedShiftFromBody(body = {}, restaurantId = '') {
  const expected = body.expectedShift && typeof body.expectedShift === 'object' ? body.expectedShift : {};
  const date = clean(expected.date || expected.scheduleDateKey || body.dateKey || '');
  return {
    ...expected,
    restaurantId,
    workspaceId: restaurantId,
    date,
    scheduleDateKey: date,
    startTime: clean(expected.startTime || body.startTime || ''),
    endTime: clean(expected.endTime || body.endTime || '')
  };
}

async function deleteSingleLogicalShift(db, restaurantId, body = {}) {
  const shiftId = clean(body.shiftId || body.docId || '');
  // One tenant scan is enough to both prove the document belongs to this workspace
  // and locate hidden logical duplicates. The three legacy-identity queries inside
  // loadTenantShiftDocs run concurrently.
  const rows = await loadTenantShiftDocs(db, restaurantId);
  let target = shiftId ? rows.find(row => row.id === shiftId) || null : null;
  if (shiftId && !target) {
    throw Object.assign(new Error('The requested shift is unavailable.'), { statusCode: 404, code: 'shift_unavailable' });
  }
  if (!target) target = expectedShiftFromBody(body, restaurantId);
  if (!shiftDateKey(target) || !timeKey(target.startTime) || !timeKey(target.endTime)) {
    throw Object.assign(new Error('The shift identity is incomplete. Refresh Schedule Builder and try again.'), { statusCode: 400, code: 'invalid_shift_identity' });
  }
  if (!personDurableKeys(target).size && !personNameKeys(target).size) {
    throw Object.assign(new Error('The shift employee identity is incomplete. Refresh Schedule Builder and try again.'), { statusCode: 400, code: 'invalid_shift_identity' });
  }

  let matches = rows.filter(row => sameLogicalShift(row, target));
  if (shiftId && !matches.some(row => row.id === shiftId)) matches = [target, ...matches];
  const unique = Array.from(new Map(matches.map(row => [row.id, row])).values());
  if (!unique.length) throw Object.assign(new Error('That shift was already removed or could not be found. Refresh Schedule Builder.'), { statusCode: 404, code: 'shift_unavailable' });

  const deletedCount = await deleteRows(db, unique);
  return { deletedCount, remainingCount: 0, targetCount: unique.length };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'method_not_allowed', error: 'Use POST.' });
  try {
    const body = parseBody(req);
    const action = clean(body.action || '');
    const restaurantId = clean(body.restaurantId || '');
    if (!restaurantId) return res.status(400).json({ ok: false, code: 'restaurant_required', error: 'Restaurant workspace is required.' });
    if (!['preview-month', 'clear-month', 'delete-single'].includes(action)) return res.status(400).json({ ok: false, code: 'invalid_action', error: 'Unsupported schedule delete action.' });

    const app = initAdmin(req);
    const authorizeSchedule = () => authorize(req, app, { allowTenantAdmin: true, targetRestaurantId: restaurantId, requiredPermissions: ['schedule'] });
    let ctx = await authorizeSchedule();
    if (!ctx.ok) return res.status(ctx.status || 403).json({ ok: false, error: ctx.error });
    const appCheck = await requireAppCheckIfEnforced(ctx.app || app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
    if (!canManageSchedule(ctx)) return res.status(403).json({ ok: false, code: 'schedule_permission_required', error: 'Schedule Builder permission is required.' });
    const db = ctx.db || app.firestore();

    if (action === 'preview-month') {
      const month = clean(body.month).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ ok: false, code: 'invalid_month', error: 'A valid schedule month is required.' });
      const preview = await previewMonth(db, restaurantId, month);
      return res.status(200).json({ ok: true, action, month, count: preview.count });
    }

    // Authorization and App Check were just verified for this request. Re-running
    // the same workspace authorization immediately before the write only adds a
    // second network round-trip without strengthening the tenant boundary.
    if (action === 'clear-month') {
      const month = clean(body.month).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ ok: false, code: 'invalid_month', error: 'A valid schedule month is required.' });
      const result = await clearMonth(db, restaurantId, month);
      if (result.remainingCount) return res.status(409).json({ ok: false, action, month, ...result, code: 'schedule_clear_incomplete', error: `${result.remainingCount} shift record(s) still remain in ${month}.` });
      await writeAudit(db, ctx, 'SCHEDULE_CLEAR_MONTH', `shifts/${month}`, `Deleted ${result.deletedCount} schedule shift record(s) from ${month}.`, restaurantId);
      return res.status(200).json({ ok: true, action, month, ...result });
    }

    const result = await deleteSingleLogicalShift(db, restaurantId, body);
    if (result.remainingCount) return res.status(409).json({ ok: false, action, ...result, code: 'schedule_shift_delete_incomplete', error: `${result.remainingCount} matching shift record(s) still remain.` });
    await writeAudit(db, ctx, 'SCHEDULE_SHIFT_DELETE', `shifts/${clean(body.shiftId || body.docId || 'logical')}`, `Deleted ${result.deletedCount} matching schedule shift record(s).`, restaurantId);
    return res.status(200).json({ ok: true, action, ...result });
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    return res.status(status).json({ ok: false, code: error?.code || 'schedule_delete_failed', error: status >= 500 ? 'The schedule delete could not be completed.' : (error?.message || 'The schedule delete could not be completed.') });
  }
};

module.exports._test = {
  MAX_BODY_BYTES,
  parseBody,
  canManageSchedule,
  tenantKeys,
  shiftTenantId,
  shiftMatchesTenant,
  shiftDateKey,
  shiftBelongsToMonth,
  clockMinutes,
  timeKey,
  personDurableKeys,
  personNameKeys,
  sameSchedulePerson,
  sameLogicalShift,
  loadTenantShiftDocs,
  deleteRows,
  previewMonth,
  clearMonth,
  expectedShiftFromBody,
  deleteSingleLogicalShift,
};
