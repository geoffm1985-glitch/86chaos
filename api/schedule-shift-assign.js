'use strict';

const crypto = require('crypto');
const { initAdmin, authorize, requireAppCheckIfEnforced, writeAudit, clean } = require('./_chaos-admin');

const MAX_BODY_BYTES = 512 * 1024;
const MAX_ASSIGNMENTS = 62;
const IDENTITY_FIELDS = [
  'scheduleUserId','employeeId','rosterUserId','userId','authUid','accountUserId','assignedUserId',
  'employeeName','assignedName','employeeEmail','assignedEmail'
];
const OPTIONAL_FIELDS = [
  'role','rosterRoleId','rosterRoleNameSnapshot',
  'availabilityOverrideReason','availabilityWarning','availabilityRecordId','scheduledOutsideAvailability',
  'rescueProtected','rescueEditable','rescueMode','rescueMonth','restoreSourceKey','sourceKey','source',
  'assignmentSource'
];

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

function validDate(value = '') {
  const text = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function validTime(value = '') {
  const raw = String(value || '').trim().toUpperCase();
  if (['OPEN','CLOSE','CL'].includes(raw)) return true;
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|A|P)?$/i);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return false;
  return match[3] ? hour >= 1 && hour <= 12 : hour >= 0 && hour <= 23;
}

function durableEmployeeIdentity(row = {}) {
  return clean(row.scheduleUserId || row.employeeId || row.rosterUserId || row.userId || row.authUid || row.accountUserId || row.assignedUserId || row.employeeEmail || row.assignedEmail || row.employeeName || row.assignedName || '');
}

function sanitizeAssignment(input = {}, restaurantId = '', actorId = '', nowIso = '') {
  const date = clean(input.date || input.scheduleDateKey || '');
  const startTime = clean(input.startTime || '');
  const endTime = clean(input.endTime || '');
  if (!validDate(date)) throw Object.assign(new Error('A valid schedule date is required.'), { statusCode: 400, code: 'invalid_shift_date' });
  if (!validTime(startTime) || !validTime(endTime)) throw Object.assign(new Error('Valid shift start and end times are required.'), { statusCode: 400, code: 'invalid_shift_time' });
  if (!durableEmployeeIdentity(input)) throw Object.assign(new Error('The selected employee identity is incomplete. Refresh Schedule Builder and try again.'), { statusCode: 400, code: 'invalid_employee_identity' });

  const row = {
    date,
    scheduleDateKey: date,
    scheduleMonth: date.slice(0, 7),
    restaurantId,
    workspaceId: restaurantId,
    revision: 1,
    startTime,
    endTime,
    isPublished: false,
    publishState: 'draft',
    scheduleBuilderDraft: true,
    readyToPublish: true,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: actorId || 'schedule-builder-server',
    updatedBy: actorId || 'schedule-builder-server',
    assignmentSource: 'schedule-builder-server'
  };
  for (const field of IDENTITY_FIELDS) {
    const value = clean(input[field]);
    if (value) row[field] = value;
  }
  for (const field of OPTIONAL_FIELDS) {
    const value = input[field];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'boolean') row[field] = value;
    else row[field] = clean(value);
  }
  return row;
}

function deterministicShiftId(operationId = '', row = {}, index = 0) {
  const basis = [clean(operationId), index, row.restaurantId, row.date, durableEmployeeIdentity(row), row.startTime, row.endTime].join('|');
  return `sb_${crypto.createHash('sha256').update(basis).digest('hex').slice(0, 28)}`;
}

async function assignRows(db, restaurantId, assignments = [], actorId = '', operationId = '') {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    throw Object.assign(new Error('At least one shift assignment is required.'), { statusCode: 400, code: 'assignments_required' });
  }
  if (assignments.length > MAX_ASSIGNMENTS) {
    throw Object.assign(new Error(`A maximum of ${MAX_ASSIGNMENTS} shifts can be assigned at once.`), { statusCode: 400, code: 'too_many_assignments' });
  }
  const nowIso = new Date().toISOString();
  const safeOperationId = clean(operationId || `assign-${nowIso}`);
  const rows = assignments.map(input => sanitizeAssignment(input, restaurantId, actorId, nowIso));
  const batch = db.batch();
  const created = rows.map((row, index) => {
    const id = deterministicShiftId(safeOperationId, row, index);
    const ref = db.collection('shifts').doc(id);
    batch.set(ref, row, { merge: false });
    return { id, ...row };
  });
  await batch.commit();
  return { createdCount: created.length, created };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'method_not_allowed', error: 'Use POST.' });
  try {
    const body = parseBody(req);
    const restaurantId = clean(body.restaurantId || '');
    if (!restaurantId) return res.status(400).json({ ok: false, code: 'restaurant_required', error: 'Restaurant workspace is required.' });

    const app = initAdmin(req);
    const ctx = await authorize(req, app, { allowTenantAdmin: true, targetRestaurantId: restaurantId, requiredPermissions: ['schedule'] });
    if (!ctx.ok) return res.status(ctx.status || 403).json({ ok: false, error: ctx.error });
    const appCheck = await requireAppCheckIfEnforced(ctx.app || app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
    if (!canManageSchedule(ctx)) return res.status(403).json({ ok: false, code: 'schedule_permission_required', error: 'Schedule Builder permission is required.' });

    const db = ctx.db || app.firestore();
    const actorId = clean(ctx.uid || ctx.user?.uid || ctx.email || 'schedule-builder-server');
    const result = await assignRows(db, restaurantId, body.assignments, actorId, body.operationId);
    await writeAudit(db, ctx, 'SCHEDULE_SHIFT_ASSIGN', `shifts/${clean(body.operationId || 'assignment')}`, `Assigned ${result.createdCount} schedule shift(s).`, restaurantId);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    return res.status(status).json({ ok: false, code: error?.code || 'schedule_assignment_failed', error: status >= 500 ? 'The schedule assignment could not be completed.' : (error?.message || 'The schedule assignment could not be completed.') });
  }
};

module.exports._test = { MAX_BODY_BYTES, MAX_ASSIGNMENTS, parseBody, canManageSchedule, validDate, validTime, durableEmployeeIdentity, sanitizeAssignment, deterministicShiftId, assignRows };
