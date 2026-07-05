const admin = require('firebase-admin');

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
    if (email === master || decoded.superAdmin === true) return { ok: true, decoded };
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

function serializeDoc(doc) {
  const data = doc.data();
  const out = { id: doc.id };
  for (const [k, v] of Object.entries(data || {})) {
    if (v && typeof v.toDate === 'function') out[k] = v.toDate().toISOString();
    else out[k] = v;
  }
  return out;
}

async function deleteSnapshotInBatches(db, snap) {
  let batch = db.batch();
  let count = 0;
  let batchCount = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    count += 1;
    batchCount += 1;
    if (batchCount >= 450) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) await batch.commit();
  return count;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
    const app = initAdmin();
    const auth = await authorize(req, app);
    if (!auth.ok) return res.status(auth.status || 401).json({ ok: false, error: auth.error });
    const body = parseBody(req);
    if (body.confirm !== 'IMPORT_JULY_2026') return res.status(400).json({ ok: false, error: 'Missing confirm value IMPORT_JULY_2026.' });

    const db = app.firestore();
    const usersSnap = await db.collection('users').where('restaurantId', '==', RESTAURANT_ID).get();
    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const byName = new Map();
    for (const u of users) {
      const key = firstName(u.name || u.email || u.id);
      if (!byName.has(key)) byName.set(key, u);
    }

    const namesNeeded = Array.from(new Set(SCHEDULE.map(s => s[1].toLowerCase())));
    const unmatched = namesNeeded.filter(name => !byName.get(name));
    if (unmatched.length) {
      return res.status(409).json({ ok: false, error: `Cannot import. Missing user profile(s) in ${RESTAURANT_ID}: ${unmatched.join(', ')}`, unmatched });
    }

    // Avoid Firestore composite-index requirement by querying the tenant only, then filtering July in memory.
    // This import is a one-time rescue operation for one restaurant, so the small extra read cost is safer than
    // requiring a production index while employees need their shifts restored.
    const allRestaurantShiftsSnap = await db.collection('shifts')
      .where('restaurantId', '==', RESTAURANT_ID)
      .get();
    const julyShiftDocs = allRestaurantShiftsSnap.docs.filter(d => {
      const date = String((d.data() || {}).date || '');
      return date >= MONTH_START && date <= MONTH_END;
    });
    const existingSnap = { docs: julyShiftDocs, size: julyShiftDocs.length };
    const backup = {
      type: 'cheers-july-2026-shift-import-backup',
      restaurantId: RESTAURANT_ID,
      month: '2026-07',
      generatedAt: new Date().toISOString(),
      actor: auth.decoded.email || auth.decoded.uid,
      replacedShiftCount: existingSnap.size,
      replacedShifts: existingSnap.docs.map(serializeDoc),
      sourceNotes: [
        'Source: 86CHAOS SCHEDULE JULY 2026 uploaded PDF.',
        'Duplicate exact Clare 11a-2p rows were deduplicated.',
        'Obvious AM/PM typos were normalized: Lani 2a-9p to 2p-9p, Chuck 10p-4p to 10a-4p.'
      ]
    };

    const deletedCount = body.deleteExisting === false ? 0 : await deleteSnapshotInBatches(db, existingSnap);

    let batch = db.batch();
    let batchCount = 0;
    let importedCount = 0;
    const now = new Date().toISOString();
    for (const [date, employeeName, startTime, endTime] of SCHEDULE) {
      const user = byName.get(employeeName.toLowerCase());
      const ref = db.collection('shifts').doc();
      batch.set(ref, {
        restaurantId: RESTAURANT_ID,
        employeeId: user.id,
        employeeName: user.name || employeeName,
        role: user.role || 'Unassigned',
        date,
        startTime,
        endTime,
        isPublished: true,
        importedAt: now,
        importedBy: auth.decoded.email || auth.decoded.uid,
        source: '86CHAOS SCHEDULE JULY 2026 PDF'
      });
      importedCount += 1;
      batchCount += 1;
      if (batchCount >= 450) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) await batch.commit();

    await db.collection('auditLogs').add({
      restaurantId: RESTAURANT_ID,
      action: 'EMERGENCY_IMPORT_JULY_SCHEDULE',
      target: 'shifts',
      details: `Deleted ${deletedCount} existing July shift(s), imported ${importedCount} published shift(s).`,
      userId: auth.decoded.uid,
      userName: auth.decoded.email || 'System Admin',
      timestamp: now,
      isGhost: false
    });

    return res.status(200).json({ ok: true, restaurantId: RESTAURANT_ID, deletedCount, importedCount, backup });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message || 'Import failed.' });
  }
};
