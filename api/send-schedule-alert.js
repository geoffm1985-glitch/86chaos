import projectAdmin from './_firebase-project-admin.js';

const { verifyRequestToken } = projectAdmin;

async function requireAppCheckIfEnforced(req, res, app) {
  const enforced = ['true', '1', 'yes', 'enforce'].includes(String(process.env.APP_CHECK_ENFORCE || '').toLowerCase().trim());
  if (!enforced) return true;
  const token = String(req.headers['x-firebase-appcheck'] || req.headers['X-Firebase-AppCheck'] || '').trim();
  if (!token) { res.status(401).json({ error: 'App Check verification is required.' }); return false; }
  try {
    const { getAppCheck } = await import('firebase-admin/app-check');
    await getAppCheck(app).verifyToken(token);
    return true;
  } catch (_) {
    res.status(401).json({ error: 'App Check verification failed.' });
    return false;
  }
}

// Schedule publication notifications are now an inseparable side effect of a
// verified, fenced schedulePublishOperations record. This compatibility route
// is deliberately closed so association-only callers cannot create a broad
// restaurant broadcast or supply recipient authority from the client.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  let verified;
  try { verified = await verifyRequestToken(req, { requireProjectCredentials: true }); }
  catch (_) { return res.status(403).json({ error: 'Schedule alert authorization failed.' }); }
  if (!await requireAppCheckIfEnforced(req, res, verified.app)) return;
  return res.status(410).json({
    error: 'Direct schedule broadcasts are disabled. Publish or resume the verified schedule operation instead.',
    code: 'verified_publication_required'
  });
}
