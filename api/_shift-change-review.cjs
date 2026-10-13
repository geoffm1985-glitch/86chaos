'use strict';
const crypto = require('node:crypto');
const clean = value => String(value == null ? '' : value).trim();
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (code, message, statusCode = 409) => { throw Object.assign(new Error(message), { code, statusCode }); };
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
function materialShift(shift = {}) {
  return {
    date: clean(shift.scheduleDateKey || shift.date), startTime: clean(shift.startTime || shift.start),
    endTime: clean(shift.endTime || shift.end), roleId: clean(shift.rosterRoleId),
    role: clean(shift.rosterRoleNameSnapshot || shift.role), location: clean(shift.location || shift.station),
    authUid: clean(shift.authUid || shift.accountUserId), employeeId: clean(shift.scheduleUserId || shift.employeeId),
    employeeName: clean(shift.employeeName || shift.assignedName), cancelled: Boolean(shift.cancelled || shift.deleted || shift.isDeleted || shift.status === 'deleted')
  };
}
function headRef(db, tenant, shiftId) { return db.collection('scheduleChangeHeads').doc(hash([tenant, shiftId])); }
function changedFields(before, after) { return Object.keys(after).filter(key => !before || before[key] !== after[key]); }
function manager(ctx) { return Boolean(ctx.isSuperAdmin || ctx.user?.isAdmin || ctx.user?.isOwner || ctx.user?.accountOwner || ctx.permissions?.schedule || ctx.permissions?.team); }
// Called inside the fenced publish transaction. All heads must be read before
// this function writes; client shift fields never provide acknowledgment proof.
function recordPublication({ db, tx, head, tenant, shiftId, shift, operationId, actor, at }) {
  const after = materialShift(shift), before = head?.after || null;
  const fields = changedFields(before, after);
  if (!fields.length) return null;
  const version = hash([tenant, shiftId, operationId, after]);
  const recipients = [...new Set([before?.authUid, after.authUid].filter(Boolean))];
  const event = { restaurantId: tenant, shiftId, version, before, after, changedFields: fields, recipientUids: recipients,
    publishedAt: at, publishedBy: actor, operationId, acknowledgmentRequired: recipients.length > 0,
    acknowledgments: {}, notificationMeaning: 'Provider acceptance does not establish delivery or acknowledgment.' };
  tx.create(db.collection('scheduleChangeEvents').doc(version), event);
  tx.set(headRef(db, tenant, shiftId), { restaurantId: tenant, shiftId, version, after, publishedAt: at });
  return event;
}
async function shiftChangeReview({ db, ctx, body, clock = () => new Date() }) {
  if (!ctx.uid || !ctx.restaurantId || ctx.restaurantId !== body.restaurantId) fail('workspace_required', 'Workspace authorization is required.', 403);
  const tenant = ctx.restaurantId;
  if (body.action === 'shift-change-list') {
    const reviewAll = body.scope === 'workspace';
    if (reviewAll && !manager(ctx)) fail('schedule_review_denied', 'Schedule review permission is required.', 403);
    let query = db.collection('scheduleChangeEvents').where('restaurantId', '==', tenant);
    if (!reviewAll) query = query.where('recipientUids', 'array-contains', ctx.uid);
    query = query.orderBy('__name__').limit(51);
    if (body.cursor) { if (!safeId(body.cursor)) fail('invalid_cursor', 'Invalid page cursor.', 400); query = query.startAfter(body.cursor); }
    const result = await query.get(), page = result.docs.slice(0, 50);
    const rows = await Promise.all(page.map(async doc => {
      const event = doc.data(), head = await headRef(db, tenant, event.shiftId).get();
      const current = head.exists && head.data().version === event.version;
      const operation = reviewAll ? await db.collection('schedulePublishOperations').doc(event.operationId).get() : null;
      const recipients = operation?.exists ? operation.data()?.notificationState?.recipients || [] : [];
      const notification = event.notificationReceipts?.[event.after.authUid] || recipients.find(row => row.authUid === event.after.authUid || row.userId === event.after.authUid || row.employeeId === event.after.employeeId);
      return { ...event, id: doc.id, current, ...(reviewAll ? { notification: { state: notification?.state || notification?.status || 'no-provider-acceptance-evidence', delivered: false } } : {}) };
    }));
    return { rows, nextCursor: result.docs.length > 50 ? page[page.length - 1].id : null, complete: result.docs.length <= 50 };
  }
  if (body.action !== 'shift-change-acknowledge' || !safeId(body.version) || body.confirmed !== true) fail('explicit_acknowledgment_required', 'Review and explicitly acknowledge the published shift.', 400);
  const ref = db.collection('scheduleChangeEvents').doc(body.version);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref), event = snap.exists ? snap.data() : null;
    if (!event || event.restaurantId !== tenant || !event.recipientUids?.includes(ctx.uid)) fail('shift_change_unavailable', 'This published change is unavailable.', 404);
    const head = await tx.get(headRef(db, tenant, event.shiftId));
    if (!head.exists || head.data().version !== body.version) fail('shift_change_superseded', 'A newer publication exists. Reload and review it first.');
    if (event.acknowledgments?.[ctx.uid]) return { version: body.version, acknowledgedAt: event.acknowledgments[ctx.uid], duplicate: true };
    const at = clock().toISOString();
    tx.update(ref, { acknowledgments: { ...(event.acknowledgments || {}), [ctx.uid]: at } });
    tx.create(db.collection('auditLogs').doc(), { restaurantId: tenant, userId: ctx.uid, action: 'SHIFT_CHANGE_ACKNOWLEDGED', target: ref.path, timestamp: at, details: { version: body.version, shiftId: event.shiftId } });
    return { version: body.version, acknowledgedAt: at };
  });
}
module.exports = { materialShift, changedFields, headRef, recordPublication, shiftChangeReview, manager };
