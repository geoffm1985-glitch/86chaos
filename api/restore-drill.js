const { initAdmin, readBody, authorize, writeAudit } = require('./_chaos-admin');

module.exports = async (req, res) => {
  try {
    const app = initAdmin();
    const ctx = await authorize(req, app, { allowTenantAdmin: false });
    if (!ctx.ok) return res.status(ctx.status || 403).json({ ok: false, error: ctx.error || 'System Administrator access required.' });
    const db = app.firestore();
    const statusRef = db.collection('system').doc('restoreDrillStatus');

    if (req.method === 'GET') {
      const snap = await statusRef.get();
      return res.status(200).json({ ok: true, restoreDrillStatus: snap.exists ? { id: snap.id, ...snap.data() } : null });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });

    const body = await readBody(req);
    const now = new Date().toISOString();
    const sourceBackupPath = String(body.sourceBackupPath || '').trim().slice(0, 500);
    const restoreProjectId = String(body.restoreProjectId || process.env.RESTORE_DRILL_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '').trim().slice(0, 120);
    const result = String(body.result || 'planned').toLowerCase().trim();
    const notes = String(body.notes || '').trim().slice(0, 1800);
    const safeResult = ['planned', 'passed', 'needs_followup', 'failed'].includes(result) ? result : 'planned';
    const drill = {
      status: safeResult,
      lastDrillAt: now,
      sourceBackupPath,
      restoreProjectId,
      notes,
      createdByUid: ctx.uid,
      createdByEmail: ctx.email || '',
      updatedAt: now,
      checklist: {
        backupSelected: Boolean(sourceBackupPath),
        restoredIntoSafeProject: safeResult === 'passed' || safeResult === 'needs_followup',
        verifiedLogin: safeResult === 'passed',
        verifiedCriticalCollections: safeResult === 'passed',
        noProductionOverwrite: true
      }
    };
    const drillRef = await db.collection('restoreDrills').add(drill);
    await statusRef.set({ ...drill, lastDrillId: drillRef.id }, { merge: true });
    await writeAudit(db, ctx, 'RESTORE_DRILL_RECORDED', 'system/restoreDrillStatus', `Restore drill ${safeResult}. ${notes || 'No notes.'}`, 'system');
    return res.status(200).json({ ok: true, restoreDrillStatus: { ...drill, lastDrillId: drillRef.id }, message: 'Restore drill status recorded.' });
  } catch (err) {
    console.error('restore-drill failed', err);
    return res.status(500).json({ ok: false, error: err.message || 'Restore drill route failed.' });
  }
};
