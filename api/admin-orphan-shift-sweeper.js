const { getAdminAppForRequest, authorize, readBody, requireAppCheckIfEnforced, writeAudit } = require('./_chaos-admin');
const { safeText, shiftIdentity, alternateEmails, userMatchesRestaurant, baseShiftClassification } = require('./_orphan-shift-logic');

const PAGE_SIZE = 300;
const WRITE_BATCH_SIZE = 400;
const CONFIRM = 'DELETE VERIFIED ORPHAN SHIFTS';
const RUN_TTL_MS = 15 * 60 * 1000;

async function requireSystemAdmin(req) {
  const app = getAdminAppForRequest(req);
  const appCheck = await requireAppCheckIfEnforced(app, req);
  if (!appCheck.ok) return { app, ok: false, status: appCheck.status || 401, error: appCheck.error };
  const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
  if (!ctx.ok || !ctx.isSuperAdmin) return { app, ok: false, status: ctx.status || 403, error: ctx.error || 'System Administrator access is required.' };
  return { app, db: ctx.db || app.firestore(), ctx, ok: true };
}
function canonicalMemberId(identity = '', restaurantId = '') {
  return `${String(identity || '').replace(/[^A-Za-z0-9_-]/g, '_')}_${String(restaurantId || '').replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 240);
}
function activeMemberRow(row = {}) { return row.isActive !== false && row.disabled !== true && String(row.status || 'active').toLowerCase() !== 'inactive'; }
async function activeMembershipExists(db, restaurantId, identity, emails = [], cache = new Map()) {
  if (!restaurantId) return false;
  const canonicalKey = `member-doc:${restaurantId}:${identity}`;
  if (identity && !cache.has(canonicalKey)) cache.set(canonicalKey, db.collection('workspaceMembers').doc(canonicalMemberId(identity, restaurantId)).get());
  if (identity) {
    const snap = await cache.get(canonicalKey);
    if (snap?.exists && String(snap.data()?.restaurantId || '') === restaurantId && activeMemberRow(snap.data() || {})) return true;
  }
  const searches = [];
  if (identity) for (const field of ['userId','uid','authUid','rosterUserId','employeeId']) searches.push([field, identity]);
  for (const email of emails.slice(0, 2)) searches.push(['email', email]);
  for (const [field, value] of searches) {
    const key = `member-query:${restaurantId}:${field}:${value}`;
    if (!cache.has(key)) cache.set(key, db.collection('workspaceMembers').where('restaurantId','==',restaurantId).where(field,'==',value).limit(1).get());
    const snap = await cache.get(key);
    if (!snap.empty && activeMemberRow(snap.docs[0].data() || {})) return true;
  }
  return false;
}
async function classifyShift(db, docSnap, cache = new Map()) {
  const data = docSnap.data() || {};
  const base = baseShiftClassification(data, docSnap.id);
  if (base.terminal) return base;
  const { restaurantId, identity, emails, evidence } = base;

  const directKey = `user-doc:${identity}`;
  if (!cache.has(directKey)) cache.set(directKey, db.collection('users').doc(identity).get());
  const direct = await cache.get(directKey);
  if (direct.exists) {
    const user = direct.data() || {};
    if (userMatchesRestaurant(user, restaurantId) || await activeMembershipExists(db, restaurantId, identity, emails, cache)) {
      return { classification: 'valid', id: docSnap.id, restaurantId, identity, reason: 'User and tenant relationship verified.' };
    }
    return { classification: 'ambiguous', id: docSnap.id, restaurantId, identity, reason: 'User exists, but tenant relationship could not be verified.', evidence };
  }

  if (await activeMembershipExists(db, restaurantId, identity, emails, cache)) {
    return { classification: 'legacy_resolvable', id: docSnap.id, restaurantId, identity, reason: 'Active tenant membership verifies a legacy identity.', evidence };
  }

  for (const email of emails) {
    const emailKey = `user-email:${email}`;
    if (!cache.has(emailKey)) cache.set(emailKey, db.collection('users').where('email','==',email).limit(3).get());
    const emailSnap = await cache.get(emailKey);
    const matches = emailSnap.docs.filter(row => userMatchesRestaurant(row.data() || {}, restaurantId));
    if (matches.length === 1) return { classification: 'legacy_resolvable', id: docSnap.id, restaurantId, identity, reason: 'Unique same-tenant email resolves legacy identity.', resolvedUserId: matches[0].id, evidence };
    if (matches.length > 1) return { classification: 'ambiguous', id: docSnap.id, restaurantId, identity, reason: 'Email identity is ambiguous.', evidence };
  }

  if (data.employeeName || data.assignedName || emails.length) {
    return { classification: 'ambiguous', id: docSnap.id, restaurantId, identity, reason: 'Legacy identity has human evidence and requires manual review.', evidence };
  }
  return { classification: 'orphan', id: docSnap.id, restaurantId, identity, reason: 'No user, active tenant membership, email, or display identity evidence was found.', evidence };
}
async function createDryRun(db, ctx) {
  const runId = `orphan_shift_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
  const runRef = db.collection('adminOrphanShiftSweepRuns').doc(runId);
  const expiresAt = new Date(Date.now() + RUN_TTL_MS);
  let last = null;
  let scanned = 0;
  let candidates = 0;
  let ambiguous = 0;
  let valid = 0;
  let legacyResolvable = 0;
  const previewCandidates = [];
  const previewAmbiguous = [];
  const lookupCache = new Map();
  let candidateBatch = db.batch();
  let candidateBatchSize = 0;
  async function flushCandidates() {
    if (!candidateBatchSize) return;
    await candidateBatch.commit();
    candidateBatch = db.batch();
    candidateBatchSize = 0;
  }
  for (;;) {
    let query = db.collection('shifts').orderBy('__name__').limit(PAGE_SIZE);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) break;
    for (const shiftSnap of snap.docs) {
      scanned += 1;
      const row = await classifyShift(db, shiftSnap, lookupCache);
      if (row.classification === 'orphan') {
        candidates += 1;
        if (previewCandidates.length < 250) previewCandidates.push(row);
        candidateBatch.set(runRef.collection('candidates').doc(shiftSnap.id), { ...row, shiftId: shiftSnap.id, approvedAtDryRun: new Date().toISOString() });
        candidateBatchSize += 1;
        if (candidateBatchSize >= WRITE_BATCH_SIZE) await flushCandidates();
      } else if (row.classification === 'ambiguous') {
        ambiguous += 1;
        if (previewAmbiguous.length < 250) previewAmbiguous.push(row);
      } else if (row.classification === 'legacy_resolvable') legacyResolvable += 1;
      else valid += 1;
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }
  await flushCandidates();
  await runRef.set({
    id: runId,
    status: 'ready',
    createdAt: new Date().toISOString(),
    expiresAt,
    createdBy: ctx.uid || ctx.email || 'system-admin',
    scanned,
    candidateCount: candidates,
    ambiguousCount: ambiguous,
    validCount: valid,
    legacyResolvableCount: legacyResolvable
  });
  return { runId, scanned, candidateCount: candidates, ambiguousCount: ambiguous, validCount: valid, legacyResolvableCount: legacyResolvable, candidates: previewCandidates, ambiguous: previewAmbiguous, expiresAt: expiresAt.toISOString() };
}
async function loadRunCandidates(runRef) {
  const rows = [];
  let last = null;
  for (;;) {
    let query = runRef.collection('candidates').orderBy('__name__').limit(PAGE_SIZE);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) break;
    snap.docs.forEach(row => rows.push({ id: row.id, ...row.data() }));
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }
  return rows;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  const auth = await requireSystemAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
  const body = await readBody(req);
  const mode = body.mode === 'execute' ? 'execute' : 'dry-run';
  if (mode === 'dry-run') {
    try {
      const run = await createDryRun(auth.db, auth.ctx);
      return res.status(200).json({ ok: true, mode, ...run });
    } catch (err) {
      return res.status(500).json({ ok: false, mode, error: safeText(err?.message || err, 220) });
    }
  }

  if (!process.env.ORPHAN_SHIFT_SWEEP_SECRET && !process.env.CRON_SECRET) return res.status(503).json({ ok: false, error: 'Secure orphan-shift execution secret is not configured. No deletion occurred.' });
  if (body.confirmation !== CONFIRM) return res.status(400).json({ ok: false, error: `${CONFIRM} confirmation required.` });
  const runId = String(body.runId || '').trim();
  if (!runId) return res.status(400).json({ ok: false, error: 'A fresh dry-run runId is required.' });
  const runRef = auth.db.collection('adminOrphanShiftSweepRuns').doc(runId);
  const runSnap = await runRef.get();
  if (!runSnap.exists) return res.status(404).json({ ok: false, error: 'Dry-run record was not found.' });
  const run = runSnap.data() || {};
  if (run.status !== 'ready' || new Date(run.expiresAt?.toDate ? run.expiresAt.toDate() : run.expiresAt || 0).getTime() <= Date.now()) return res.status(409).json({ ok: false, error: 'Dry run is expired or no longer executable.' });
  const allowedCandidates = await loadRunCandidates(runRef);
  const requestedSet = new Set(Array.isArray(body.candidateIds) && body.candidateIds.length ? body.candidateIds.map(String) : allowedCandidates.map(row => row.id));
  const approved = allowedCandidates.filter(row => requestedSet.has(row.id));
  const revalidated = [];
  const preserved = [];
  const revalidationCache = new Map();
  for (const candidate of approved) {
    const shiftSnap = await auth.db.collection('shifts').doc(candidate.id).get();
    if (!shiftSnap.exists) { preserved.push({ id: candidate.id, reason: 'already missing' }); continue; }
    const current = await classifyShift(auth.db, shiftSnap, revalidationCache);
    if (current.classification === 'orphan') revalidated.push(candidate.id);
    else preserved.push({ id: candidate.id, reason: `revalidated as ${current.classification}` });
  }
  let deleted = 0;
  const failed = [];
  for (let i = 0; i < revalidated.length; i += WRITE_BATCH_SIZE) {
    const ids = revalidated.slice(i, i + WRITE_BATCH_SIZE);
    const batch = auth.db.batch();
    ids.forEach(id => batch.delete(auth.db.collection('shifts').doc(id)));
    try { await batch.commit(); deleted += ids.length; }
    catch (err) { ids.forEach(id => failed.push({ id, error: safeText(err?.message || err) })); }
  }
  await runRef.set({ status: failed.length ? 'partial' : 'completed', executedAt: new Date().toISOString(), executedBy: auth.ctx.uid || auth.ctx.email || '', requestedCount: approved.length, revalidatedCount: revalidated.length, deletedCount: deleted, preservedCount: preserved.length, failedCount: failed.length }, { merge: true });
  let auditWarning = '';
  try { await writeAudit(auth.db, auth.ctx, 'SYSTEM_ORPHAN_SHIFT_SWEEP', 'shifts', JSON.stringify({ runId, approved: approved.length, revalidated: revalidated.length, deleted, preserved: preserved.length, failed: failed.length }), 'platform'); }
  catch (err) { auditWarning = safeText(err?.message || err); }
  return res.status(failed.length ? 207 : 200).json({ ok: failed.length === 0, mode, runId, requested: approved.length, revalidated: revalidated.length, deleted, preserved, failed, auditWarning });
};
module.exports.config = { maxDuration: 300 };
module.exports._test = { shiftIdentity, userMatchesRestaurant, classifyShift, baseShiftClassification };
