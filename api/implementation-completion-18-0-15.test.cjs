'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeFirestore } = require('../test-tools/fakeFirestore.cjs');
const { recordPublication, headRef, materialShift, shiftChangeReview } = require('./_shift-change-review.cjs');
const { foodSafetyEvidence, dateWindow, recordDigest } = require('./_food-safety-evidence.cjs');
const { foodSafety } = require('./_food-safety');
const { assertPayloadAllowed, executeGenericMutation } = require('./safe-write')._test;
const employee = { uid: 'employee-a', restaurantId: 'tenant-a', permissions: {}, user: {} };
const shift = { restaurantId: 'tenant-a', date: '2026-10-13', startTime: '09:00', endTime: '17:00', rosterRoleId: 'cook', rosterRoleNameSnapshot: 'Cook', authUid: 'employee-a', employeeId: 'roster-a', employeeName: 'Employee A' };
async function publish(db, value = shift, operationId = 'publication_operation_1') {
  return db.runTransaction(async tx => {
    const ref = headRef(db, 'tenant-a', 'shift-a'), prior = await tx.get(ref);
    return recordPublication({ db, tx, head: prior.exists ? prior.data() : null, tenant: 'tenant-a', shiftId: 'shift-a', shift: value, operationId, actor: 'manager-a', at: '2026-10-13T12:00:00Z' });
  });
}
test('shift publication records exact material version and unchanged republish creates no new acknowledgment', async () => {
  const db = fakeFirestore(), event = await publish(db), before = db.writes.length;
  assert.equal(event.after.authUid, 'employee-a'); assert.equal(event.acknowledgmentRequired, true);
  assert.equal(await publish(db, { ...shift, revision: 90, updatedAt: 'later' }, 'publication_operation_2'), null);
  assert.equal(db.writes.length, before);
});
test('employee acknowledgment is explicit, idempotent and never changes a shift or pay', async () => {
  const db = fakeFirestore({ 'shifts/shift-a': shift }), event = await publish(db);
  await assert.rejects(() => shiftChangeReview({ db, ctx: employee, body: { action: 'shift-change-acknowledge', restaurantId: 'tenant-a', version: event.version } }), error => error.code === 'explicit_acknowledgment_required');
  const body = { action: 'shift-change-acknowledge', restaurantId: 'tenant-a', version: event.version, confirmed: true };
  await shiftChangeReview({ db, ctx: employee, body }); const writes = db.writes.length;
  assert.equal((await shiftChangeReview({ db, ctx: employee, body })).duplicate, true); assert.equal(db.writes.length, writes);
  assert.deepEqual(db.records.get('shifts/shift-a'), shift);
});
test('another employee and a manager cannot acknowledge on behalf of the assigned employee', async () => {
  const db = fakeFirestore(), event = await publish(db);
  for (const ctx of [{ ...employee, uid: 'employee-b' }, { ...employee, uid: 'manager-a', permissions: { schedule: true } }, { ...employee, restaurantId: 'tenant-b' }]) {
    const before = db.writes.length;
    await assert.rejects(() => shiftChangeReview({ db, ctx, body: { action: 'shift-change-acknowledge', restaurantId: ctx.restaurantId, version: event.version, confirmed: true } }), error => error.statusCode === 404);
    assert.equal(db.writes.length, before);
  }
});
test('a stale acknowledgment cannot satisfy a newer publication; reassignment retains both affected employees', async () => {
  const db = fakeFirestore(), old = await publish(db);
  const next = await publish(db, { ...shift, authUid: 'employee-b', employeeId: 'roster-b', startTime: '10:00' }, 'publication_operation_2');
  assert.deepEqual(next.recipientUids, ['employee-a', 'employee-b']); assert.equal(next.before.startTime, '09:00');
  await assert.rejects(() => shiftChangeReview({ db, ctx: employee, body: { action: 'shift-change-acknowledge', restaurantId: 'tenant-a', version: old.version, confirmed: true } }), error => error.code === 'shift_change_superseded');
  await shiftChangeReview({ db, ctx: employee, body: { action: 'shift-change-acknowledge', restaurantId: 'tenant-a', version: next.version, confirmed: true } });
  assert.equal(Object.keys(db.records.get(`scheduleChangeEvents/${next.version}`).acknowledgments).length, 1);
});
test('publication status never exposes another employee push token while delivery is pending',()=>{
  const {publicNotificationState}=require('./_schedule-publish-service.cjs');
  const state=publicNotificationState({status:'sending',recipients:[{userId:'employee',tokens:['private-device-token'],status:'pending',attemptCount:1,secret:'private'}]});
  assert.doesNotMatch(JSON.stringify(state),/private-device-token|secret/);assert.equal(state.recipients[0].status,'pending');
});
test('workspace shift evidence listing denies ordinary staff', async () => {
  await assert.rejects(() => shiftChangeReview({ db: fakeFirestore(), ctx: employee, body: { restaurantId: 'tenant-a', action: 'shift-change-list', scope: 'workspace' } }), error => error.statusCode === 403);
});
test('material snapshot does not ingest arbitrary nested client authority or payroll', () => {
  const snapshot = materialShift({ ...shift, isSuperAdmin: true, wages: 200, acknowledgments: { forged: 'yes' } });
  assert.equal(snapshot.wages, undefined); assert.equal(snapshot.acknowledgments, undefined);
});
const original = { restaurantId: 'tenant-a', itemId: 'cooler', itemName: 'Cooler', status: 'Attention', temp: 49, category: 'Cooler temperature', requiredMin: null, requiredMax: 41, timestamp: '2026-10-13T12:00:00Z', correctiveAction: 'Move product to verified cold storage', notes: '', safetyRevision: 1 };
const followUp = { ...original, status: 'Safe', temp: 39, timestamp: '2026-10-13T12:15:00Z', correctiveAction: '' };
const closeBody = { action: 'food-safety-close', logId: 'original', followUpLogId: 'followup', expectedTimestamp: original.timestamp, note: 'Verified replacement cooler and product temperature.', confirmed: true };
const safetyDb = (patch = {}) => fakeFirestore({ 'tempLogs/original': original, 'tempLogs/followup': followUp, ...patch });
const close = (db, body = closeBody, manager = true) => foodSafetyEvidence({ db, ctx: employee, body, manager });
test('safety closure preserves original reading and binds immutable original/follow-up proof', async () => {
  const db = safetyDb(), result = await close(db), log = db.records.get('tempLogs/original');
  assert.equal(log.temp, 49); assert.equal(log.status, 'Attention'); assert.equal(result.closure.originalDigest, recordDigest(original));
  assert.equal(result.closure.followUpDigest, recordDigest(followUp));
  const writes = db.writes.length; assert.equal((await close(db)).duplicate, true); assert.equal(db.writes.length, writes);
});
test('safety closure rejects missing permission, confirmation, stale original and different retry intent', async () => {
  await assert.rejects(() => close(safetyDb(), closeBody, false), error => error.statusCode === 403);
  for (const body of [{ ...closeBody, confirmed: false }, { ...closeBody, expectedTimestamp: 'old' }, { ...closeBody, note: 'x' }]) {
    const db = safetyDb(); await assert.rejects(() => close(db, body)); assert.equal(db.writes.length, 0);
  }
  const db = safetyDb(); await close(db);
  await assert.rejects(() => close(db, { ...closeBody, note: 'Different verification' }), error => error.code === 'closure_conflict');
});
test('safety closure rejects foreign, wrong-item, unsafe and earlier follow-up evidence without writes', async () => {
  for (const patch of [{ restaurantId: 'tenant-b' }, { itemId: 'oven' }, { status: 'Attention' }, { temp: 99, status: 'Safe' }, { timestamp: '2099-10-13T12:15:00Z' }, { timestamp: '2026-10-13T11:00:00Z' }]) {
    const db = safetyDb({ 'tempLogs/followup': { ...followUp, ...patch } });
    await assert.rejects(() => close(db)); assert.equal(db.writes.length, 0);
  }
});
test('generic write cannot erase a new safety record or forge closure/acknowledgment proof', async () => {
  for (const data of [{ closureEvidence: {} }, { acknowledgments: {} }, { safetyRevision: 1 }, { reviewedByManager: true }]) assert.throws(() => assertPayloadAllowed('tempLogs', data, 'add'));
  const db = safetyDb(); await assert.rejects(() => executeGenericMutation(db, { collectionName: 'tempLogs', action: 'delete', docId: 'original', data: {}, restaurantId: 'tenant-a', actor: 'manager', nowIso: 'now' }), error => error.code === 'immutable_safety_evidence');
  assert.equal(db.writes.length, 0);
});
test('reused food-safety request identity cannot silently change the reading', async () => {
  const db = fakeFirestore({ 'lineCheckItems/cooler': { restaurantId: 'tenant-a', name: 'Cooler', category: 'Cooler temperature' } });
  const ctx = { ...employee, permissions: { prep: true } }, body = { action: 'food-safety-log', itemId: 'cooler', requestId: 'request-one', temp: 39 };
  await foodSafety({ db, ctx, body }); assert.equal((await foodSafety({ db, ctx, body })).duplicate, true);
  await assert.rejects(() => foodSafety({ db, ctx, body: { ...body, temp: 40 } }), error => error.statusCode === 409);
});
test('audit window rejects invalid calendar days, reversed ranges and unbounded scans', () => {
  assert.deepEqual(dateWindow({ startDate: '2026-10-01', endDate: '2026-10-31' }), { startDate: '2026-10-01', endDate: '2026-10-31' });
  for (const [startDate,endDate] of [['2026-02-30','2026-03-01'],['2026-10-02','2026-10-01'],['2026-09-01','2026-10-31'],['','']]) assert.throws(() => dateWindow({ startDate,endDate }));
});
