const { authorize, readBody, clean } = require('./_chaos-admin');

const { normalizePreset, presetKey, dedupePresets, canEditSchedule } = require('./custom-shift-presets-utils.cjs');
async function readRows(db, restaurantId) {
  const snap = await db.collection('customShiftPresets').where('restaurantId', '==', restaurantId).limit(200).get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  const body = req.method === 'POST' ? await readBody(req) : {};
  const restaurantId = clean(req.query?.restaurantId || body.restaurantId);
  if (!restaurantId) return res.status(400).json({ ok: false, code: 'missing-workspace', error: 'Workspace is required.' });
  const ctx = await authorize(req, { allowTenantAdmin: true, targetRestaurantId: restaurantId });
  if (!ctx.ok) return res.status(ctx.status || 403).json({ ok: false, code: 'not-authorized', error: ctx.error || 'Not authorized.' });
  if (!canEditSchedule(ctx)) return res.status(403).json({ ok: false, code: 'schedule-permission-required', error: 'Schedule Builder permission is required.' });
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
      await ref.set({ restaurantId, label: p.label, start: p.start, end: p.end, createdAt: now, updatedAt: now, createdBy: ctx.uid, source: 'schedule_builder_custom_shift_migration' });
      created += 1;
    }
    const rows = dedupePresets(await readRows(db, restaurantId));
    return res.status(200).json({ ok: true, action: 'merge', restaurantId, created, presets: rows });
  }
  if (action === 'create' || action === 'update') {
    const p = normalizePreset(body.preset || body);
    if (!p) return res.status(400).json({ ok: false, code: 'invalid-preset', error: 'Use a name, start time, and end time.' });
    const ref = p.id && action === 'update' ? db.collection('customShiftPresets').doc(p.id) : db.collection('customShiftPresets').doc();
    await ref.set({ restaurantId, label: p.label, start: p.start, end: p.end, updatedAt: now, updatedBy: ctx.uid, ...(action === 'create' ? { createdAt: now, createdBy: ctx.uid } : {}) }, { merge: true });
    const saved = { id: ref.id, label: p.label, start: p.start, end: p.end };
    return res.status(200).json({ ok: true, action, restaurantId, preset: saved, presets: dedupePresets(await readRows(db, restaurantId)) });
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
Object.assign(module.exports, require('./custom-shift-presets-utils.cjs'));
