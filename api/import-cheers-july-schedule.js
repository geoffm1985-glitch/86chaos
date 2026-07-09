const admin = require('firebase-admin');
const { requireMfaIfEnforced } = require('./_chaos-admin');
const {
  stableShiftDocId,
  hardReplaceScheduleMonth
} = require('./schedule-restore-utils');

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    try { return JSON.parse(raw); } catch (_) { throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.'); }
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  };
}

function initAdmin() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = loadServiceAccount();
  const projectId = serviceAccount.project_id || serviceAccount.projectId;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.firebasestorage.app` : undefined);
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount), storageBucket });
}

async function authorize(req, app) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return { ok: false, status: 401, error: 'Missing authorization token.' };
  try {
    const decoded = await app.auth().verifyIdToken(token);
    const master = (process.env.MASTER_ADMIN_EMAIL || 'geoffm1985@gmail.com').toLowerCase();
    const email = (decoded.email || '').toLowerCase();
    if (email === master || decoded.superAdmin === true) {
      const mfa = requireMfaIfEnforced(decoded, {}, true);
      if (!mfa.ok) return mfa;
      return { ok: true, decoded, mfa };
    }
    return { ok: false, status: 403, error: 'Only master admin or super admin can run this import.' };
  } catch (err) {
    return { ok: false, status: 401, error: `Invalid token: ${err.message}` };
  }
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}

const RESTAURANT_ID = 'cheers_chilton_01';
const MONTH_START = '2026-07-01';
const MONTH_END = '2026-07-31';
const SOURCE_KEY = 'cheers-july-2026-builder-overwrite-v3';
const SCHEDULE = [
  ['2026-07-01','Chuck','10:00','21:00'],['2026-07-01','Julia','10:00','16:00'],['2026-07-01','Maicol','16:00','21:00'],['2026-07-01','Lani','16:00','21:00'],
  ['2026-07-02','Lani','10:00','21:00'],['2026-07-02','Geoff','10:00','21:00'],['2026-07-02','Ellis','16:00','21:00'],['2026-07-02','Maicol','16:00','21:00'],
  ['2026-07-03','Ellis','16:00','21:00'],['2026-07-03','Clare','11:00','14:00'],['2026-07-03','Chuck','14:00','22:00'],['2026-07-03','Lani','10:00','21:00'],['2026-07-03','Geoff','10:00','21:00'],
  ['2026-07-04','Lani','10:00','16:00'],['2026-07-04','Chuck','10:00','16:00'],
  ['2026-07-07','Chuck','10:00','16:00'],['2026-07-07','Geoff','09:00','15:00'],['2026-07-07','Julia','16:00','21:00'],['2026-07-07','Lani','16:00','21:00'],['2026-07-07','Maicol','16:00','21:00'],
  ['2026-07-08','Lani','16:00','21:00'],['2026-07-08','Julia','10:00','16:00'],['2026-07-08','Geoff','09:00','15:00'],['2026-07-08','Maicol','16:00','21:00'],['2026-07-08','Chuck','16:00','21:00'],
  ['2026-07-09','Lani','14:00','21:00'],['2026-07-09','Ellis','16:00','21:00'],['2026-07-09','Chuck','10:00','21:00'],['2026-07-09','Maicol','16:00','21:00'],
  ['2026-07-10','Clare','11:00','14:00'],['2026-07-10','Chuck','10:00','22:00'],['2026-07-10','Geoff','10:00','22:00'],['2026-07-10','Ellis','16:00','21:00'],['2026-07-10','Lani','14:00','22:00'],
  ['2026-07-11','Maicol','16:00','21:00'],['2026-07-11','Lani','10:00','21:00'],['2026-07-11','Geoff','10:00','16:00'],
  ['2026-07-12','Maicol','16:00','21:00'],['2026-07-12','Chuck','10:00','16:00'],['2026-07-12','Geoff','09:00','15:00'],['2026-07-12','Lani','16:00','21:00'],
  ['2026-07-13','Maicol','16:00','21:00'],['2026-07-13','Geoff','09:00','15:00'],['2026-07-13','Julia','10:00','21:00'],
  ['2026-07-14','Geoff','09:00','15:00'],['2026-07-14','Julia','10:00','21:00'],
  ['2026-07-15','Maicol','16:00','21:00'],['2026-07-15','Lani','16:00','21:00'],['2026-07-15','Geoff','09:00','15:00'],['2026-07-15','Julia','10:00','16:00'],
  ['2026-07-16','Lani','10:00','21:00'],['2026-07-16','Ellis','16:00','21:00'],['2026-07-16','Chuck','10:00','21:00'],
  ['2026-07-17','Clare','11:00','14:00'],['2026-07-17','Maicol','16:00','22:00'],['2026-07-17','Geoff','10:00','21:00'],['2026-07-17','Chuck','10:00','21:00'],['2026-07-17','Ellis','16:00','21:00'],
  ['2026-07-18','Lani','10:00','21:00'],['2026-07-18','Chuck','10:00','16:00'],['2026-07-18','Maicol','16:00','21:00'],
  ['2026-07-19','Geoff','10:00','16:00'],['2026-07-19','Lani','16:00','21:00'],['2026-07-19','Maicol','10:00','21:00'],
  ['2026-07-20','Chuck','10:00','21:00'],['2026-07-20','Ellis','16:00','21:00'],['2026-07-20','Lani','16:00','21:00'],['2026-07-20','Geoff','10:00','16:00'],
  ['2026-07-21','Chuck','10:00','16:00'],['2026-07-21','Maicol','16:00','21:00'],['2026-07-21','Geoff','09:00','15:00'],['2026-07-21','Lani','16:00','21:00'],
  ['2026-07-22','Julia','10:00','16:00'],['2026-07-22','Geoff','09:00','15:00'],['2026-07-22','Lani','16:00','21:00'],['2026-07-22','Maicol','16:00','21:00'],
  ['2026-07-23','Geoff','10:00','16:00'],['2026-07-23','Ellis','16:00','21:00'],['2026-07-23','Maicol','16:00','21:00'],['2026-07-23','Chuck','10:00','21:00'],
  ['2026-07-24','Clare','11:00','14:00'],['2026-07-24','Maicol','16:00','22:00'],['2026-07-24','Chuck','10:00','21:00'],['2026-07-24','Lani','14:00','21:00'],['2026-07-24','Geoff','10:00','21:00'],['2026-07-24','Ellis','16:00','21:00'],
  ['2026-07-25','Maicol','16:00','21:00'],['2026-07-25','Lani','10:00','21:00'],['2026-07-25','Chuck','10:00','16:00'],
  ['2026-07-26','Maicol','16:00','21:00'],['2026-07-26','Geoff','10:00','16:00'],['2026-07-26','Chuck','10:00','16:00'],['2026-07-26','Lani','16:00','21:00'],
  ['2026-07-27','Julia','10:00','21:00'],['2026-07-27','Ellis','16:00','21:00'],['2026-07-27','Chuck','10:00','21:00'],
  ['2026-07-28','Julia','10:00','16:00'],['2026-07-28','Geoff','09:00','15:00'],['2026-07-28','Maicol','16:00','21:00'],['2026-07-28','Lani','16:00','21:00'],
  ['2026-07-29','Geoff','09:00','15:00'],['2026-07-29','Chuck','16:00','21:00'],['2026-07-29','Maicol','16:00','21:00'],['2026-07-29','Julia','10:00','16:00'],
  ['2026-07-30','Geoff','09:00','15:00'],['2026-07-30','Chuck','10:00','21:00'],['2026-07-30','Maicol','15:00','21:00'],['2026-07-30','Ellis','16:00','21:00'],
  ['2026-07-31','Clare','11:00','14:00'],['2026-07-31','Lani','14:00','22:00'],['2026-07-31','Ellis','16:00','21:00'],['2026-07-31','Geoff','10:00','21:00'],['2026-07-31','Chuck','10:00','21:00']
];

function firstName(value) {
  return String(value || '').trim().split(/\s+/)[0].toLowerCase();
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
    const app = initAdmin();
    const auth = await authorize(req, app);
    if (!auth.ok) return res.status(auth.status || 401).json({ ok: false, error: auth.error });
    const body = parseBody(req);
    if (body.confirm !== 'IMPORT_JULY_2026') return res.status(400).json({ ok: false, error: 'Missing confirm value IMPORT_JULY_2026.' });
    if (body.restaurantId && body.restaurantId !== RESTAURANT_ID) return res.status(400).json({ ok: false, error: `This emergency import is locked to ${RESTAURANT_ID}.` });

    const db = app.firestore();
    const runStarted = new Date();
    const runId = `schedule-rescue-${runStarted.toISOString().replace(/[:.]/g, '-')}`;
    const actor = auth.decoded.email || auth.decoded.uid || 'System Admin';

    const usersSnap = await db.collection('users').where('restaurantId', '==', RESTAURANT_ID).get();
    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const byName = new Map();
    for (const u of users) {
      const key = firstName(u.name || u.displayName || u.email || u.id);
      if (!byName.has(key)) byName.set(key, u);
    }

    const namesNeeded = uniqueSorted(SCHEDULE.map(s => firstName(s[1])));
    const unmatched = namesNeeded.filter(name => !byName.get(name));
    if (unmatched.length) {
      return res.status(409).json({ ok: false, error: `Cannot import. Missing user profile(s) in ${RESTAURANT_ID}: ${unmatched.join(', ')}`, unmatched });
    }

    const backupMeta = {
      type: 'schedule-month-hard-replace-backup',
      restaurantId: RESTAURANT_ID,
      month: '2026-07',
      sourceKey: SOURCE_KEY,
      generatedAt: runStarted.toISOString(),
      actor,
      runId,
      sourceNotes: [
        'Source: 86CHAOS SCHEDULE JULY 2026 uploaded PDF.',
        'This is a hard Schedule Builder replacement, not a merge. It removes all existing July 2026 shift records for this restaurant before writing the source schedule as unpublished builder drafts.',
        'Restore armor handles older/restored shift records with date strings, timestamps, scheduleMonth metadata, or messy date fields.',
        'Duplicate exact Clare 11a-2p rows were deduplicated.',
        'Obvious AM/PM typos were normalized: Lani 2a-9p to 2p-9p, Chuck 10p-4p to 10a-4p.'
      ]
    };

    const restoreGeneration = admin.firestore.Timestamp.fromDate(runStarted);
    const result = await hardReplaceScheduleMonth(db, {
      restaurantId: RESTAURANT_ID,
      monthStart: MONTH_START,
      monthEnd: MONTH_END,
      backupMeta,
      makeImportOperations: async () => SCHEDULE.map(([date, employeeName, startTime, endTime]) => {
        const user = byName.get(firstName(employeeName));
        const docId = stableShiftDocId({ restaurantId: RESTAURANT_ID, sourceKey: SOURCE_KEY, date, employeeId: user.id, employeeName, startTime, endTime });
        const ref = db.collection('shifts').doc(docId);
        return batch => batch.set(ref, {
          restaurantId: RESTAURANT_ID,
          employeeId: user.id,
          employeeName: user.name || employeeName,
          role: user.role || 'Unassigned',
          date,
          scheduleDateKey: date,
          scheduleMonth: '2026-07',
          startTime,
          endTime,
          isPublished: false,
          publishState: 'draft',
          scheduleBuilderDraft: true,
          scheduleBuilderEditable: true,
          readyToPublish: true,
          createdAt: runStarted.toISOString(),
          updatedAt: runStarted.toISOString(),
          createdBy: actor,
          updatedBy: actor,
          importedAt: runStarted.toISOString(),
          importedBy: actor,
          restoredAt: restoreGeneration,
          restoredBy: actor,
          restoreRunId: runId,
          restoreSourceKey: SOURCE_KEY,
          sourceKey: SOURCE_KEY,
          source: '86CHAOS SCHEDULE JULY 2026 PDF',
          sourceLocked: false,
          rescueProtected: true,
          rescueEditable: true,
          rescueMode: 'schedule_builder_overwrite',
          rescueMonth: '2026-07'
        }, { merge: false });
      })
    });

    const seedDoc = {
      restaurantId: RESTAURANT_ID,
      month: '2026-07',
      monthStart: MONTH_START,
      monthEnd: MONTH_END,
      sourceKey: SOURCE_KEY,
      sourceTitle: '86CHAOS SCHEDULE JULY 2026',
      rowCount: SCHEDULE.length,
      rows: SCHEDULE.map(([date, employeeName, startTime, endTime]) => ({ date, employeeName, startTime, endTime })),
      updatedAt: runStarted.toISOString(),
      updatedBy: actor,
      purpose: 'System-wide emergency schedule restore seed. Use this after any full database restore if the July Schedule Builder is missing or contaminated by old records. The seed reloads the month as unpublished drafts so a manager can review and republish.'
    };

    await db.collection('scheduleRestoreSeeds').doc(`${RESTAURANT_ID}_2026_07`).set(seedDoc, { merge: false });

    const runDoc = {
      restaurantId: RESTAURANT_ID,
      action: 'HARD_REPLACE_SCHEDULE_BUILDER_MONTH',
      month: '2026-07',
      monthStart: MONTH_START,
      monthEnd: MONTH_END,
      sourceKey: SOURCE_KEY,
      runId,
      deletedCount: result.deletedCount,
      importedCount: result.importedCount,
      actor,
      startedAt: runStarted.toISOString(),
      finishedAt: new Date().toISOString(),
      note: 'Deletes all existing shifts for the month/restaurant first, then writes the source schedule as unpublished Schedule Builder drafts using deterministic document IDs. Manager can review and republish.'
    };
    await db.collection('scheduleRestoreRuns').doc(runId).set(runDoc, { merge: false });
    await db.collection('restaurants').doc(RESTAURANT_ID).set({
      lastScheduleRescueRunId: runId,
      lastScheduleRescueAt: runDoc.finishedAt,
      lastScheduleRescueMonth: '2026-07',
      scheduleRefreshToken: runId,
      forceRefresh: runId,
      scheduleRescueEnforceProtected: true,
      scheduleRescueBuilderOverwriteMonths: admin.firestore.FieldValue.arrayUnion('2026-07'),
      scheduleRescueDraftMonths: admin.firestore.FieldValue.arrayUnion('2026-07'),
      scheduleRescueProtectedMonths: admin.firestore.FieldValue.arrayUnion('2026-07')
    }, { merge: true });

    await db.collection('auditLogs').add({
      restaurantId: RESTAURANT_ID,
      action: 'EMERGENCY_IMPORT_JULY_SCHEDULE_BUILDER_OVERWRITE',
      target: 'shifts',
      details: `Hard-overwrote July 2026 Schedule Builder. Deleted ${result.deletedCount} existing July shift(s), imported ${result.importedCount} unpublished draft shift(s) for review/republish. Run ${runId}.`,
      userId: auth.decoded.uid,
      userName: actor,
      timestamp: runDoc.finishedAt,
      isGhost: false
    });

    return res.status(200).json({
      ok: true,
      restaurantId: RESTAURANT_ID,
      mode: 'schedule-builder-hard-overwrite-draft',
      month: '2026-07',
      runId,
      deletedCount: result.deletedCount,
      importedCount: result.importedCount,
      backup: result.backup
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message || 'Import failed.' });
  }
};
