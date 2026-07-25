const admin = require('firebase-admin');
const { getAdminAppForRequest } = require('./_firebase-project-admin');
const { requireMfaIfEnforced, masterEmails } = require('./_chaos-admin');

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    try { return JSON.parse(raw); }
    catch (_) { throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.'); }
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  };
}

function initAdmin(req) {
  return getAdminAppForRequest(req, { requireCredentials: true });
}

async function authorize(req, adminApp) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return { ok: false, status: 401, error: 'Missing authorization token.' };
  try {
    const decoded = await adminApp.auth().verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase().trim();
    const userSnap = await adminApp.firestore().collection('users').doc(decoded.uid).get();
    const user = userSnap.exists ? (userSnap.data() || {}) : {};
    if (masterEmails().includes(email) || decoded.superAdmin === true || user.isSuperAdmin === true || user.systemAccess?.superAdmin === true) {
      const mfa = requireMfaIfEnforced(decoded, user, true);
      if (!mfa.ok) return mfa;
      return { ok: true, actor: decoded.email || decoded.uid, mfa };
    }
    return { ok: false, status: 403, error: 'Only a System Administrator can list backups.' };
  } catch (err) {
    return { ok: false, status: 401, error: `Invalid authorization token: ${err.message}` };
  }
}

function parseDateFromName(name) {
  const match = name.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
  if (!match) return null;
  const iso = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
  const d = new Date(iso + 'Z');
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Use GET.' });
    const adminApp = initAdmin(req);
    const auth = await authorize(req, adminApp);
    if (!auth.ok) return res.status(auth.status || 401).json({ ok: false, error: auth.error });

    const bucket = adminApp.storage().bucket();
    const includeSignedUrls = req.query?.includeSignedUrls === '1' || req.query?.includeSignedUrls === 'true';
    const [files] = await bucket.getFiles({ prefix: 'backups/firestore/' });
    const backups = [];

    for (const file of files) {
      if (!file.name.endsWith('.json.gz')) continue;
      const [metadata] = await file.getMetadata().catch(() => [{}]);
      const custom = metadata?.metadata || {};
      const modeFromPath = file.name.includes('/manual/') ? 'manual' : file.name.includes('/scheduled/') ? 'scheduled' : file.name.includes('/watchdog/') ? 'watchdog' : 'unknown';
      const createdAt = metadata.timeCreated || parseDateFromName(file.name) || null;
      const updatedAt = metadata.updated || createdAt;
      const sizeBytes = Number(metadata.size || 0);
      let signedUrl = '';
      if (includeSignedUrls) {
        try {
          const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 });
          signedUrl = url;
        } catch (_) {}
      }
      const backupRow = {
        path: file.name,
        name: file.name.split('/').pop(),
        mode: custom.mode || modeFromPath,
        runId: custom.runId || file.name.split('/').pop()?.replace('.json.gz', '') || '',
        actor: custom.actor || '',
        documentCount: Number(custom.documentCount || 0),
        collectionCount: Number(custom.collectionCount || 0),
        sizeBytes,
        createdAt,
        updatedAt,
        integrityStatus: custom.integrityStatus || 'unknown',
        integrityVerifiedAt: custom.integrityVerifiedAt || '',
        integrityErrors: custom.integrityErrors || '',
        sha256: custom.sha256 || ''
      };
      if (includeSignedUrls) backupRow.signedUrl = signedUrl;
      backups.push(backupRow);
    }

    backups.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));
    const totalBytes = backups.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
    const verifiedCount = backups.filter(item => item.integrityStatus === 'verified').length;
    let storageUsage = { totalFiles: backups.length, totalBytes, backupFiles: backups.length, backupBytes: totalBytes };
    if (req.query?.includeUsage === '1' || req.query?.includeUsage === 'true') {
      const [allFiles] = await bucket.getFiles();
      let allBytes = 0;
      for (const file of allFiles) {
        const [metadata] = await file.getMetadata().catch(() => [{}]);
        allBytes += Number(metadata?.size || 0);
      }
      storageUsage = { totalFiles: allFiles.length, totalBytes: allBytes, backupFiles: backups.length, backupBytes: totalBytes };
    }
    return res.status(200).json({ ok: true, backups: backups.slice(0, 100), count: backups.length, bucket: bucket.name, totalBytes, verifiedCount, storageUsage, signedUrlsIncluded: includeSignedUrls });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = handler;
module.exports.config = { maxDuration: 30 };
