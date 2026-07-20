const { initAdmin, requireAppCheckIfEnforced, readBody, norm, masterEmails } = require('./_chaos-admin');
const { getBearerToken } = require('./_firebase-project-admin');
const { enforceRateLimit, sendRateLimited } = require('./_rate-limit');

function cleanText(value = '', max = 2000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanCategory(value = '') {
  const allowed = new Set([
    'Bug / Error',
    'Feature Request',
    'Login Problem',
    'Permission Problem',
    'Data Looks Wrong',
    'Mobile Layout Problem'
  ]);
  const raw = String(value || '').trim();
  return allowed.has(raw) ? raw : 'Bug / Error';
}

function collectTokens(user = {}) {
  const tokens = new Set();
  if (typeof user.fcmToken === 'string' && user.fcmToken.trim()) tokens.add(user.fcmToken.trim());
  if (Array.isArray(user.fcmTokens)) user.fcmTokens.forEach(t => { if (typeof t === 'string' && t.trim()) tokens.add(t.trim()); });
  if (Array.isArray(user.pushTokens)) user.pushTokens.forEach(t => {
    const token = typeof t === 'string' ? t : (t?.token || t?.fcmToken || '');
    if (token) tokens.add(String(token).trim());
  });
  if (user.pushDevices && typeof user.pushDevices === 'object') {
    Object.values(user.pushDevices).forEach(device => {
      const token = typeof device === 'string' ? device : (device?.token || device?.fcmToken || '');
      if (token) tokens.add(String(token).trim());
    });
  }
  return [...tokens].filter(Boolean).slice(0, 500);
}

async function getCaller(db, decoded = {}) {
  let snap = null;
  try { snap = await db.collection('users').doc(decoded.uid).get(); } catch (_) {}
  if (snap?.exists) return { id: snap.id, ...snap.data() };
  const email = norm(decoded.email || '');
  if (email) {
    const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!byEmail.empty) return { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
  }
  return { id: decoded.uid || '', email, name: decoded.name || decoded.email || 'Unknown user' };
}

async function loadSuperAdminUsers(db) {
  const admins = new Map();
  const addDoc = (docSnap) => {
    if (!docSnap?.exists) return;
    const data = docSnap.data() || {};
    admins.set(docSnap.id, { id: docSnap.id, ...data });
  };

  await Promise.allSettled([
    db.collection('users').where('isSuperAdmin', '==', true).limit(100).get().then(snap => snap.forEach(addDoc)),
    db.collection('users').where('systemAccess.superAdmin', '==', true).limit(100).get().then(snap => snap.forEach(addDoc))
  ]);

  const emails = masterEmails();
  await Promise.allSettled(emails.slice(0, 25).map(async (email) => {
    const snap = await db.collection('users').where('email', '==', email).limit(5).get();
    snap.forEach(addDoc);
  }));

  return [...admins.values()].filter(user => user?.isActive !== false && user?.disabled !== true);
}

async function sendSuperAdminPush(app, db, report, reporter) {
  const messaging = app.messaging();
  const admins = await loadSuperAdminUsers(db);
  const tokenRecords = [];
  const seenTokens = new Set();

  admins.forEach(adminUser => {
    collectTokens(adminUser).forEach(token => {
      if (seenTokens.has(token)) return;
      seenTokens.add(token);
      tokenRecords.push({ token, userId: adminUser.id, email: adminUser.email || '' });
    });
  });

  if (!tokenRecords.length) {
    return { attempted: true, sentCount: 0, failedCount: 0, eligibleAdminCount: admins.length, missingTokens: true, staleTokensCleaned: 0, failures: [] };
  }

  const category = cleanCategory(report.category);
  const restaurant = cleanText(report.restaurantName || report.restaurantId || 'Unknown workspace', 120);
  const reporterName = cleanText(reporter?.name || report.user || report.userEmail || 'A user', 80);
  const snippet = cleanText(report.rawMessage || report.message || '', 160);
  const payload = {
    notification: {
      title: `86 Chaos bug report: ${category}`,
      body: `${reporterName} • ${restaurant}: ${snippet || 'Open System Administrator → Support to review.'}`.slice(0, 240)
    },
    data: {
      type: 'bug_report',
      reportId: String(report.reportId || ''),
      restaurantId: String(report.restaurantId || ''),
      category,
      route: 'godmode',
      targetTab: 'support'
    },
    tokens: tokenRecords.map(record => record.token)
  };

  const response = await messaging.sendEachForMulticast(payload);
  const staleCodes = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument'
  ]);
  const cleanup = [];
  const failures = [];
  response.responses.forEach((result, idx) => {
    if (result.success) return;
    const record = tokenRecords[idx];
    const code = result.error?.code || 'unknown';
    failures.push({ userId: record?.userId || '', email: record?.email || '', code, message: result.error?.message || '' });
    if (record?.userId && staleCodes.has(code)) {
      cleanup.push(db.collection('users').doc(record.userId).set({
        fcmToken: null,
        pushNeedsRepair: true,
        pushRepairFlaggedAt: new Date().toISOString(),
        lastPushFailureCode: code
      }, { merge: true }));
    }
  });
  await Promise.allSettled(cleanup);
  return {
    attempted: true,
    sentCount: response.successCount,
    failedCount: response.failureCount,
    eligibleAdminCount: admins.length,
    tokenCount: tokenRecords.length,
    missingTokens: false,
    staleTokensCleaned: cleanup.length,
    failures: failures.slice(0, 25)
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  let app;
  let decoded;
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Missing Firebase authorization token.' });
    app = initAdmin(req);
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
    decoded = await app.auth().verifyIdToken(token);
  } catch (error) {
    return res.status(403).json({ ok: false, error: `Bug report authorization failed: ${error.message}` });
  }

  const db = app.firestore();
  const rate = await enforceRateLimit({ db, req, decoded, routeName: 'report-bug', limit: Number(process.env.BUG_REPORT_RATE_LIMIT || 12), windowMs: 60 * 1000 });
  if (!rate.ok) return sendRateLimited(res, rate);

  try {
    const body = await readBody(req);
    const rawMessage = cleanText(body.message || body.bugText || '', 2500);
    if (!rawMessage) return res.status(400).json({ ok: false, error: 'Bug report message is required.' });

    const caller = await getCaller(db, decoded);
    const nowIso = new Date().toISOString();
    const restaurantId = cleanText(body.restaurantId || caller.restaurantId || caller.activeRestaurantId || 'Unknown', 120);
    const report = {
      type: 'user_reported_bug',
      category: cleanCategory(body.category),
      message: `USER REPORT: ${rawMessage}`,
      rawMessage,
      user: cleanText(caller.name || body.user || decoded.name || decoded.email || 'Unknown', 120),
      userId: caller.id || decoded.uid || '',
      userEmail: cleanText(caller.email || decoded.email || body.userEmail || '', 160),
      restaurantId,
      restaurantName: cleanText(body.restaurantName || caller.restaurantName || caller.restaurant || '', 160),
      activeTab: cleanText(body.activeTab || 'help', 80),
      userAgent: cleanText(body.userAgent || req.headers['user-agent'] || '', 500),
      screenSize: cleanText(body.screenSize || '', 80),
      url: cleanText(body.url || '', 600),
      time: nowIso,
      createdAt: nowIso,
      status: 'new',
      source: 'help_center_report_problem',
      supportPushRequested: true,
      supportPushAttemptedAt: nowIso
    };

    const reportRef = await db.collection('crashReports').add(report);
    const pushResult = await sendSuperAdminPush(app, db, { ...report, reportId: reportRef.id }, caller).catch(error => ({
      attempted: true,
      sentCount: 0,
      failedCount: 1,
      error: error.message || String(error),
      failures: [{ code: 'send_failed', message: error.message || String(error) }]
    }));

    await reportRef.set({
      supportPushReportId: reportRef.id,
      supportPushSentCount: Number(pushResult.sentCount || 0),
      supportPushFailedCount: Number(pushResult.failedCount || 0),
      supportPushEligibleAdminCount: Number(pushResult.eligibleAdminCount || 0),
      supportPushTokenCount: Number(pushResult.tokenCount || 0),
      supportPushMissingTokens: pushResult.missingTokens === true,
      supportPushStaleTokensCleaned: Number(pushResult.staleTokensCleaned || 0),
      supportPushFailures: Array.isArray(pushResult.failures) ? pushResult.failures.slice(0, 10) : [],
      supportPushError: pushResult.error || '',
      supportPushCompletedAt: new Date().toISOString()
    }, { merge: true });

    await db.collection('auditLogs').add({
      restaurantId: restaurantId || 'Unknown',
      action: 'BUG_REPORT_SUBMITTED',
      target: `crashReports/${reportRef.id}`,
      details: `${report.category} submitted from ${report.activeTab}. Super admin push sent: ${pushResult.sentCount || 0}.`,
      userId: caller.id || decoded.uid || '',
      userName: caller.name || decoded.email || 'Unknown user',
      userEmail: caller.email || decoded.email || '',
      timestamp: new Date().toISOString(),
      metadata: {
        category: report.category,
        activeTab: report.activeTab,
        supportPushSentCount: pushResult.sentCount || 0,
        supportPushFailedCount: pushResult.failedCount || 0,
        supportPushEligibleAdminCount: pushResult.eligibleAdminCount || 0,
        supportPushMissingTokens: pushResult.missingTokens === true
      }
    }).catch(() => {});

    return res.status(200).json({
      ok: true,
      reportId: reportRef.id,
      supportPushSentCount: pushResult.sentCount || 0,
      supportPushFailedCount: pushResult.failedCount || 0,
      supportPushEligibleAdminCount: pushResult.eligibleAdminCount || 0,
      supportPushMissingTokens: pushResult.missingTokens === true
    });
  } catch (error) {
    console.error('[report-bug] failed:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Failed to submit bug report.' });
  }
};
