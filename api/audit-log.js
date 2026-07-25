const { admin, initAdmin, requireAppCheckIfEnforced, verifyTrustedFirebaseIdToken, readWorkspaceMember, userHasWorkspace, profileForWorkspace, masterEmails, norm, clean } = require('./_chaos-admin');
const { enforceRateLimit, sendRateLimited } = require('./_rate-limit');

function bearer(req) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function cleanString(value, max = 500) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

async function resolveAccount(db, decoded) {
  const email = norm(decoded.email || '');
  let userSnap = await db.collection('users').doc(decoded.uid).get();
  let userDocId = decoded.uid;
  let user = userSnap.exists ? userSnap.data() : null;
  if (!user && email) {
    const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!byEmail.empty) {
      userSnap = byEmail.docs[0];
      userDocId = userSnap.id;
      user = userSnap.data();
    }
  }
  return { userDocId, user: user || {}, email };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });

  let app;
  let decoded;
  try {
    app = initAdmin(req);
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
    const token = bearer(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Missing Firebase authorization token.' });
    decoded = await verifyTrustedFirebaseIdToken(token);
  } catch (err) {
    return res.status(401).json({ ok: false, error: `Invalid authorization token: ${err.message}` });
  }

  const db = app.firestore();
  const rate = await enforceRateLimit({
    db,
    req,
    decoded,
    routeName: 'audit-log',
    limit: Number(process.env.AUDIT_LOG_RATE_LIMIT || 120),
    windowMs: 60 * 1000
  });
  if (!rate.ok) return sendRateLimited(res, rate);

  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.body || '{}');
    const restaurantId = cleanString(body.restaurantId || '', 160);
    const { userDocId, user, email } = await resolveAccount(db, decoded);
    const isSuperAdmin = Boolean(decoded.superAdmin === true || user?.isSuperAdmin === true || user?.systemAccess?.superAdmin === true || masterEmails().includes(email));
    const member = restaurantId && !isSuperAdmin ? await readWorkspaceMember(db, decoded.uid, email, restaurantId) : null;
    const belongs = isSuperAdmin || !restaurantId || userHasWorkspace(user, restaurantId) || Boolean(member);
    if (!belongs) return res.status(403).json({ ok: false, error: 'You are not a member of that workspace.' });

    const workspaceUser = profileForWorkspace({ ...(user || {}), id: userDocId }, member, restaurantId) || user || {};
    const isGhost = body.isGhost === true && isSuperAdmin;
    const payload = {
      restaurantId: restaurantId || workspaceUser.restaurantId || 'system',
      action: cleanString(body.action || 'CLIENT_ACTION', 160),
      target: cleanString(body.target || '', 320),
      details: cleanString(body.details || '', 2500),
      userId: isGhost ? cleanString(body.ghostRealUserId || decoded.uid, 160) : decoded.uid,
      userName: isGhost
        ? `${cleanString(body.ghostRealUserName || workspaceUser.name || decoded.email || 'System', 160)} (Ghost${body.ghostTargetUserName ? ` as ${cleanString(body.ghostTargetUserName, 160)}` : ''})`
        : cleanString(workspaceUser.name || decoded.name || decoded.email || 'Unknown user', 200),
      userEmail: cleanString(workspaceUser.email || decoded.email || '', 200),
      ghostTargetUserId: isGhost ? cleanString(body.ghostTargetUserId || '', 160) : null,
      ghostTargetUserName: isGhost ? cleanString(body.ghostTargetUserName || '', 200) : null,
      ghostWorkspaceId: isGhost ? cleanString(body.ghostWorkspaceId || restaurantId || '', 160) : null,
      sessionId: cleanString(body.sessionId || '', 160),
      isGhost,
      timestamp: new Date().toISOString(),
      serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: 'api/audit-log'
    };
    const ref = await db.collection('auditLogs').add(payload);
    return res.status(200).json({ ok: true, id: ref.id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: `Could not write audit log: ${err.message}` });
  }
};
