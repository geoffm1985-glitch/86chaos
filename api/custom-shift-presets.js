const { getAdminAppForRequest, readBody, clean, norm, readWorkspaceMember, userHasWorkspace, profileForWorkspace, requireAppCheckIfEnforced } = require('./_chaos-admin');
const { decidePlatformAdminAuthority } = require('./_platform-admin-authority.cjs');
const { normalizePreset, presetKey, dedupePresets, canEditSchedule } = require('./custom-shift-presets-utils.cjs');

function activeUser(user = {}) {
  return Boolean(user && typeof user === 'object' && user.isActive !== false && user.disabled !== true && user.deleted !== true && user.archived !== true && user.accountDisabled !== true && !/disabled|inactive|deleted|archived|removed/i.test(String(user.status || '')));
}
function activeMember(member = {}) {
  return Boolean(member && typeof member === 'object' && member.isActive !== false && member.disabled !== true && member.deleted !== true && member.archived !== true && !/disabled|inactive|deleted|archived|removed/i.test(String(member.status || '')));
}
async function loadUserByToken(db, decoded = {}) {
  const uid = clean(decoded.uid);
  const email = norm(decoded.email);
  let snap = uid ? await db.collection('users').doc(uid).get() : null;
  if (snap?.exists) return { id: snap.id, ...snap.data() };
  if (email) {
    const byAuth = await db.collection('users').where('authUid', '==', uid).limit(2).get();
    if (byAuth.size === 1) return { id: byAuth.docs[0].id, ...byAuth.docs[0].data() };
    const byUid = await db.collection('users').where('uid', '==', uid).limit(2).get();
    if (byUid.size === 1) return { id: byUid.docs[0].id, ...byUid.docs[0].data() };
    const byEmail = await db.collection('users').where('email', '==', email).limit(2).get();
    if (byEmail.size === 1) return { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
    if (byEmail.size > 1 || byAuth.size > 1 || byUid.size > 1) throw Object.assign(new Error('ambiguous-user'), { status: 403, code: 'ambiguous-user' });
  }
  return null;
}
async function authorizeScheduleBuilder(req, restaurantId) {
  const app = getAdminAppForRequest(req);
  const appCheck = await requireAppCheckIfEnforced(app, req);
  if (!appCheck.ok) return { ok: false, status: appCheck.status || 401, code: 'app-check-required', error: appCheck.error };
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, status: 401, code: 'missing-token', error: 'Missing Firebase authorization token.' };
  try {
    const decoded = await app.auth().verifyIdToken(token);
    const db = app.firestore();
    const user = await loadUserByToken(db, decoded);
    const email = norm(decoded.email || user?.email);
    const member = await readWorkspaceMember(db, decoded.uid, email, restaurantId);
    const platform = decidePlatformAdminAuthority({ decoded, profile: user || {}, masterEmails: [], protectedRootEmails: [] });
    const hasWorkspace = Boolean(platform.superAdmin || activeMember(member) || (activeUser(user) && userHasWorkspace(user, restaurantId)));
    if (!hasWorkspace) return { ok: false, status: 403, code: 'workspace-access-required', error: 'Workspace access is required.' };
    const profile = platform.superAdmin ? { ...(user || {}), id: user?.id || decoded.uid, isSuperAdmin: true, isAdmin: true, permissions: { scheduleBuilder: true, scheduleEditing: true, ...(user?.permissions || {}) } } : profileForWorkspace({ ...(user || {}), id: user?.id || decoded.uid }, member, restaurantId);
    if (!platform.superAdmin && (!activeUser(profile) || !canEditSchedule({ user: profile, permissions: profile.permissions }))) return { ok: false, status: 403, code: 'schedule-permission-required', error: 'Schedule Builder permission is required.' };
    return { ok: true, app, db, decoded, uid: decoded.uid, email, user: profile, member, isSuperAdmin: platform.superAdmin, restaurantId, appCheck };
  } catch (error) {
    return { ok: false, status: error.status || 401, code: error.code || 'invalid-token', error: error.message || 'Authorization failed.' };
  }
}
async function readRows(db, restaurantId) {
  const snap = await db.collection('customShiftPresets').where('restaurantId', '==', restaurantId).limit(200).get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  const body = req.method === 'POST' ? await readBody(req) : {};
  const restaurantId = clean(req.query?.restaurantId || body.restaurantId);
  if (!restaurantId) return res.status(400).json({ ok: false, code: 'missing-workspace', error: 'Workspace is required.' });
  const ctx = await authorizeScheduleBuilder(req, restaurantId);
  if (!ctx.ok) return res.status(ctx.status || 403).json({ ok: false, code: ctx.code || 'not-authorized', error: ctx.error || 'Not authorized.' });
  const db = ctx.db;
  const now = new Date().toISOString();
  if (req.method === 'GET' || body.action === 'list') {
    const rows = dedupePresets(await readRows(db, restaurantId));
    return res.status(200).json({ ok: true, action: 'list', restaurantId, presets: rows, source: 'server' });
  }
  const action = clean(body.action || 'merge').toLowerCase();
  if (action === 'merge') {
    const incoming = dedupePresets(body.presets || []);
    const existing = dedupePresets(await readRows(db, restaurantId));
    const byKey = new Map(existing.map(p => [presetKey(p), p]));
    let created = 0;
    for (const p of incoming) {
      if (byKey.has(presetKey(p))) continue;
      const ref = db.collection('customShiftPresets').doc();
      await ref.set({ restaurantId, label: p.label, start: p.start, end: p.end, createdAt: now, updatedAt: now, createdBy: ctx.uid, updatedBy: ctx.uid, source: 'schedule_builder_custom_shift_migration' });
      created += 1;
    }
    return res.status(200).json({ ok: true, action: 'merge', restaurantId, created, presets: dedupePresets(await readRows(db, restaurantId)) });
  }
  if (action === 'create') {
    const p = normalizePreset(body.preset || body);
    if (!p) return res.status(400).json({ ok: false, code: 'invalid-preset', error: 'Use a name, start time, and end time.' });
    const ref = db.collection('customShiftPresets').doc();
    await ref.set({ restaurantId, label: p.label, start: p.start, end: p.end, createdAt: now, createdBy: ctx.uid, updatedAt: now, updatedBy: ctx.uid });
    return res.status(200).json({ ok: true, action, restaurantId, preset: { id: ref.id, label: p.label, start: p.start, end: p.end }, presets: dedupePresets(await readRows(db, restaurantId)) });
  }
  if (action === 'update') {
    const p = normalizePreset(body.preset || body);
    if (!p?.id) return res.status(400).json({ ok: false, code: 'missing-preset', error: 'Preset is required.' });
    const ref = db.collection('customShiftPresets').doc(p.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, code: 'not-found', error: 'Preset was not found.' });
    if (snap.data()?.restaurantId !== restaurantId) return res.status(403).json({ ok: false, code: 'wrong-workspace', error: 'Preset belongs to another workspace.' });
    await ref.set({ label: p.label, start: p.start, end: p.end, updatedAt: now, updatedBy: ctx.uid }, { merge: true });
    return res.status(200).json({ ok: true, action, restaurantId, preset: { id: ref.id, label: p.label, start: p.start, end: p.end }, presets: dedupePresets(await readRows(db, restaurantId)) });
  }
  if (action === 'delete') {
    const id = clean(body.id || body.presetId);
    if (!id) return res.status(400).json({ ok: false, code: 'missing-preset', error: 'Preset is required.' });
    const ref = db.collection('customShiftPresets').doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.restaurantId !== restaurantId) return res.status(404).json({ ok: false, code: 'not-found', error: 'Preset was not found.' });
    await ref.delete();
    return res.status(200).json({ ok: true, action: 'delete', restaurantId, id, presets: dedupePresets(await readRows(db, restaurantId)) });
  }
  return res.status(400).json({ ok: false, code: 'unknown-action', error: 'Unknown custom shift action.' });
}

module.exports = handler;
Object.assign(module.exports, require('./custom-shift-presets-utils.cjs'), { authorizeScheduleBuilder, activeUser, activeMember });
