'use strict';
const { safeId, assertTenant, hash } = require('./_invoice-approval');
const { evaluateFoodSafety, expectation } = require('../src/core/foodSafety.cjs');
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
function canSignOff(ctx) { return Boolean(ctx.isSuperAdmin || ctx.user?.isAdmin || ctx.user?.isOwner || ctx.user?.accountOwner || ctx.permissions?.team); }
async function foodSafety({ db, ctx, body }) {
  if (!ctx.uid || !ctx.restaurantId) fail('Workspace authorization is required.', 403);
  const manager = canSignOff(ctx);
  if (!manager && !ctx.permissions?.prep && !ctx.permissions?.kitchen) fail('Prep permission is required.', 403);
  if (body.action === 'food-safety-config') {
    if (!manager) fail('Manager approval is required for log expectations.', 403);
    const input = body.item || {}; expectation(input);
    if (!String(input.name || '').trim()) fail('Name the item, location, or equipment.');
    if (!safeId(body.itemId || body.requestId)) fail('A valid operation identity is required.');
    const ref = db.collection('lineCheckItems').doc(body.itemId || `check_${hash(ctx.restaurantId + body.requestId).slice(0, 40)}`);
    return db.runTransaction(async tx => {
      const prior = await tx.get(ref); if (prior.exists) assertTenant(prior.data(), ctx.restaurantId);
      const fields = { name: String(input.name).trim().slice(0, 160), category: input.category, location: String(input.location || '').slice(0, 120),
        requiredMin: input.requiredMin ?? '', requiredMax: input.requiredMax ?? '', requiredEveryHours: input.requiredEveryHours || '' };
      if (prior.exists && Object.keys(fields).every(key => (prior.data()[key] ?? '') === fields[key])) return { id: ref.id, duplicate: true };
      const at = new Date().toISOString();
      tx.set(ref, { ...fields, restaurantId: ctx.restaurantId, updatedAt: at, updatedBy: ctx.uid }, { merge: true });
      tx.set(db.collection('auditLogs').doc(), { restaurantId: ctx.restaurantId, userId: ctx.uid, action: 'FOOD_SAFETY_EXPECTATION', target: ref.path, timestamp: at, details: { before: prior.exists ? prior.data() : null, after: fields } });
      return { id: ref.id };
    });
  }
  if (body.action === 'food-safety-signoff') {
    if (!manager) fail('Manager approval is required for sign-off.', 403);
    if (!safeId(body.logId)) fail('Select a log.');
    const ref = db.collection('tempLogs').doc(body.logId);
    return db.runTransaction(async tx => {
      const snap = await tx.get(ref); assertTenant(snap.exists ? snap.data() : null, ctx.restaurantId);
      if (snap.data().reviewedByManager) return { id: ref.id, duplicate: true };
      const note = String(body.note || '').trim().slice(0, 500); if (note.length < 4) fail('Add a brief manager sign-off note.');
      const at = new Date().toISOString();
      tx.update(ref, { reviewedByManager: true, reviewedAt: at, reviewedBy: ctx.uid, managerNote: note });
      tx.set(db.collection('auditLogs').doc(), { restaurantId: ctx.restaurantId, userId: ctx.uid, action: 'FOOD_SAFETY_SIGNOFF', target: ref.path, timestamp: at, details: note });
      return { id: ref.id };
    });
  }
  if (body.action !== 'food-safety-log' || !safeId(body.itemId) || !safeId(body.requestId)) fail('A log item and valid request identity are required.');
  const ref = db.collection('tempLogs').doc(`log_${hash(ctx.restaurantId + '|' + ctx.uid + '|' + body.requestId)}`);
  return db.runTransaction(async tx => {
    const [prior, item] = await Promise.all([tx.get(ref), tx.get(db.collection('lineCheckItems').doc(body.itemId))]);
    if (prior.exists) { assertTenant(prior.data(), ctx.restaurantId); return { id: ref.id, duplicate: true }; }
    assertTenant(item.exists ? item.data() : null, ctx.restaurantId);
    const result = evaluateFoodSafety(item.data(), body); const at = new Date().toISOString();
    const localDate = /^\d{4}-\d{2}-\d{2}$/.test(body.localDate || '') && Math.abs(Date.parse(body.localDate) - Date.parse(at.slice(0, 10))) <= 86400000 ? body.localDate : at.slice(0, 10);
    tx.set(ref, { ...result, restaurantId: ctx.restaurantId, itemId: item.id, itemName: item.data().name, category: item.data().category,
      location: item.data().location || '', loggedBy: ctx.user?.name || ctx.uid, loggedByUid: ctx.uid, timestamp: at, date: localDate });
    tx.update(item.ref, { lastLoggedAt: at });
    return { id: ref.id, ...result };
  });
}
module.exports = { foodSafety, canSignOff };
