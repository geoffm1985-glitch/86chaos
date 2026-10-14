'use strict';
const { safeId, assertTenant, hash } = require('./_invoice-approval');
const {evaluateFoodSafety}=require('../src/core/foodSafety.cjs');
const fail = (code, message, statusCode = 400) => { throw Object.assign(new Error(message), { code, statusCode }); };
function recordDigest(record) {
  const { reviewedByManager, reviewedAt, reviewedBy, managerNote, closureEvidence, closureRequired, safetyRevision, ...original } = record;
  return hash(JSON.stringify(Object.fromEntries(Object.entries(original).sort(([a], [b]) => a.localeCompare(b)))));
}
function dateWindow(body) {
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  let ok = false;
  try { ok = valid(body.startDate) && valid(body.endDate); } catch (_) {}
  const days = (Date.parse(body.endDate) - Date.parse(body.startDate)) / 86400000;
  if (!ok || days < 0 || days > 30) fail('invalid_safety_window', 'Select a valid audit window of at most 31 days.');
  return { startDate: body.startDate, endDate: body.endDate };
}
async function foodSafetyEvidence({ db, ctx, body, manager, clock = () => new Date() }) {
  if (!manager) fail('safety_manager_required', 'Manager review permission is required.', 403);
  if (body.action === 'food-safety-export') {
    const window = dateWindow(body);
    let query = db.collection('tempLogs').where('restaurantId', '==', ctx.restaurantId).where('date', '>=', window.startDate).where('date', '<=', window.endDate).orderBy('date').orderBy('__name__').limit(101);
    if (body.cursor) {
      if (!safeId(body.cursor)) fail('invalid_cursor', 'Invalid audit cursor.');
      const snap = await db.collection('tempLogs').doc(body.cursor).get();
      assertTenant(snap.exists ? snap.data() : null, ctx.restaurantId);
      if (snap.data().date < window.startDate || snap.data().date > window.endDate) fail('invalid_cursor', 'Audit cursor is outside this window.');
      query = query.startAfter(snap);
    }
    const result = await query.get(), page = result.docs.slice(0, 100);
    const rows = await Promise.all(page.map(async snap => {
      const log = snap.data(), closure = await db.collection('foodSafetyClosures').doc(snap.id).get();
      const evidence = closure.exists ? closure.data() : null;
      const followUp = evidence ? await db.collection('tempLogs').doc(evidence.followUpLogId).get() : null;
      const verified = evidence && evidence.restaurantId === ctx.restaurantId && evidence.originalDigest === recordDigest(log) && followUp?.exists && followUp.data().restaurantId === ctx.restaurantId && evidence.followUpDigest === recordDigest(followUp.data());
      return { ...log, id: snap.id, closure: evidence, integrity: evidence ? verified ? 'verified' : 'changed-after-closure' : 'no-closure' };
    }));
    return { window, rows, generatedAt: clock().toISOString(), nextCursor: result.docs.length > 100 ? page[page.length - 1].id : null, complete: result.docs.length <= 100 };
  }
  if (body.action !== 'food-safety-close' || body.confirmed !== true || !safeId(body.logId) || !safeId(body.followUpLogId) || body.logId === body.followUpLogId) fail('closure_review_required', 'Review the original record and a separate follow-up check before closure.');
  const note = String(body.note || '').trim();
  if (note.length < 4 || note.length > 1000) fail('closure_note_required', 'Add a manager verification note (4–1000 characters).');
  const ref = db.collection('tempLogs').doc(body.logId), closureRef = db.collection('foodSafetyClosures').doc(body.logId);
  return db.runTransaction(async tx => {
    const [originalSnap, followUpSnap, prior] = await Promise.all([tx.get(ref), tx.get(db.collection('tempLogs').doc(body.followUpLogId)), tx.get(closureRef)]);
    const original = originalSnap.exists ? originalSnap.data() : null, followUp = followUpSnap.exists ? followUpSnap.data() : null;
    assertTenant(original, ctx.restaurantId); assertTenant(followUp, ctx.restaurantId);
    const originalDigest = recordDigest(original), followUpDigest = recordDigest(followUp);
    const intent = hash(JSON.stringify([ctx.restaurantId, body.logId, body.followUpLogId, note]));
    if (prior.exists) {
      if (prior.data().intent !== intent) fail('closure_conflict', 'This check has already been closed with different evidence.', 409);
      if (prior.data().originalDigest !== originalDigest || prior.data().followUpDigest !== followUpDigest) fail('closure_evidence_changed', 'The recorded evidence changed. Review the audit trail.', 409);
      return { id: body.logId, closure: prior.data(), duplicate: true };
    }
    if (body.expectedTimestamp !== original.timestamp) fail('stale_safety_record', 'Reload the original check before closure.', 409);
    if (original.status !== 'Attention' || !original.correctiveAction || followUp.status !== 'Safe' || followUp.itemId !== original.itemId || (followUp.requiredMin ?? null) !== (original.requiredMin ?? null) || (followUp.requiredMax ?? null) !== (original.requiredMax ?? null) || followUp.category !== original.category || !(Date.parse(followUp.timestamp) > Date.parse(original.timestamp))) fail('closure_evidence_invalid', 'Closure requires an attention record, corrective action and a later safe check for the same item.');
    const at = clock().toISOString();
    if(Date.parse(followUp.timestamp)>Date.parse(at)) fail('closure_evidence_invalid','The follow-up check cannot be dated in the future.');
    let verifiedFollowUp;
    try { verifiedFollowUp=evaluateFoodSafety({category:followUp.category,requiredMin:followUp.requiredMin,requiredMax:followUp.requiredMax},{temp:followUp.temp,checklistResult:followUp.result,notes:followUp.notes,correctiveAction:followUp.correctiveAction}); }
    catch (_) { fail('closure_evidence_invalid','The follow-up values do not establish a valid safe check.'); }
    if(verifiedFollowUp.status!=='Safe') fail('closure_evidence_invalid','The recorded follow-up values remain outside their safety limits.');
    const closure = { restaurantId: ctx.restaurantId, logId: body.logId, followUpLogId: body.followUpLogId, originalDigest, followUpDigest, intent, note, closedAt: at, closedBy: ctx.uid, status: 'closed' };
    tx.create(closureRef, closure);
    tx.update(ref, { safetyRevision:Math.max(1,Number(original.safetyRevision)||0), closureRequired: false, reviewedByManager: true, reviewedAt: at, reviewedBy: ctx.uid, managerNote: note, closureEvidence: { closedAt: at, followUpLogId: body.followUpLogId } });
    tx.update(followUpSnap.ref,{safetyRevision:Math.max(1,Number(followUp.safetyRevision)||0)});
    tx.create(db.collection('auditLogs').doc(), { restaurantId: ctx.restaurantId, userId: ctx.uid, action: 'FOOD_SAFETY_CLOSED', target: ref.path, timestamp: at, details: closure });
    return { id: body.logId, closure };
  });
}
module.exports = { foodSafetyEvidence, recordDigest, dateWindow };
