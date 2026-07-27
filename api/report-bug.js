const { initAdmin, requireAppCheckIfEnforced, readBody, norm, masterEmails } = require('./_chaos-admin');
const { getBearerToken } = require('./_firebase-project-admin');
const { enforceRateLimit, sendRateLimited } = require('./_rate-limit');
const { sendBugReportEmail } = require('./_support-email');

function cleanText(value = '', max = 2000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanCategory(value = '') {
  const allowed = new Set([
    'Bug / Error',
    'Crash / Error',
    'Feature Request',
    'Login Problem',
    'Permission Problem',
    'Data Looks Wrong',
    'Mobile Layout Problem'
  ]);
  const raw = String(value || '').trim();
  return allowed.has(raw) ? raw : 'Bug / Error';
}


function cleanList(value = [], maxItems = 25, maxText = 500) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map(item => {
    if (typeof item === 'string') return cleanText(item, maxText);
    try { return JSON.parse(JSON.stringify(item)); } catch (_) { return cleanText(item, maxText); }
  });
}

function sanitizedCrashDiagnostics(body = {}, req = {}) {
  const diagnostics = body.diagnostics && typeof body.diagnostics === 'object' ? body.diagnostics : {};
  return {
    reportSource: cleanText(body.source || body.reportSource || '', 80),
    rawStack: cleanText(body.rawStack || body.stack || '', 5000),
    componentStack: cleanText(body.componentStack || '', 5000),
    breadcrumbs: cleanList(body.breadcrumbs, 25, 500),
    diagnostics: JSON.parse(JSON.stringify({
      route: body.route || body.activeTab || diagnostics.route || '',
      tab: body.tab || body.activeTab || diagnostics.tab || '',
      chunkUrl: body.chunkUrl || body.failedChunkUrl || diagnostics.chunkUrl || '',
      appVersion: body.appVersion || body.clientVersion || diagnostics.appVersion || '',
      deploymentId: body.deploymentId || body.vercelDeploymentId || diagnostics.deploymentId || '',
      online: typeof body.online === 'boolean' ? body.online : diagnostics.online,
      serviceWorkerState: body.serviceWorkerState || diagnostics.serviceWorkerState || '',
      errorName: body.errorName || diagnostics.errorName || '',
      errorMessage: body.errorMessage || body.message || diagnostics.errorMessage || '',
      url: body.url || diagnostics.url || '',
      userAgent: body.userAgent || req.headers?.['user-agent'] || '',
      viewport: body.viewport || body.screenSize || diagnostics.viewport || ''
    })),
    route: cleanText(body.route || body.activeTab || diagnostics.route || '', 120),
    tab: cleanText(body.tab || body.activeTab || diagnostics.tab || '', 120),
    chunkUrl: cleanText(body.chunkUrl || body.failedChunkUrl || diagnostics.chunkUrl || '', 1000),
    appVersion: cleanText(body.appVersion || body.clientVersion || diagnostics.appVersion || '', 80),
    deploymentId: cleanText(body.deploymentId || body.vercelDeploymentId || diagnostics.deploymentId || '', 180),
    online: typeof body.online === 'boolean' ? body.online : null,
    serviceWorkerState: cleanText(body.serviceWorkerState || diagnostics.serviceWorkerState || '', 120),
    errorName: cleanText(body.errorName || diagnostics.errorName || '', 120),
    errorMessage: cleanText(body.errorMessage || diagnostics.errorMessage || body.message || '', 2000)
  };
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
    return { attempted: true, fcmAcceptedCount: 0, fcmRejectedCount: 0, eligibleAdminCount: admins.length, missingTokens: true, staleTokensCleaned: 0, failures: [], tokenCount: 0, deliveryConfirmedCount: 0, openedCount: 0 };
  }

  const category = cleanCategory(report.category);
  const restaurant = cleanText(report.restaurantName || report.restaurantId || 'Unknown workspace', 120);
  const reporterName = cleanText(reporter?.name || report.user || report.userEmail || 'A user', 80);
  const snippet = cleanText(report.rawMessage || report.message || '', 160);
  const title = `86 Chaos bug report: ${category}`;
  const body = `${reporterName} • ${restaurant}: ${snippet || 'Open System Administrator → Support to review.'}`.slice(0, 240);
  const tag = `86chaos-bug-report:${String(report.reportId || category || Date.now())}`.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 120);
  const payload = {
    notification: { title, body },
    data: {
      type: 'bug_report',
      reportId: String(report.reportId || ''),
      restaurantId: String(report.restaurantId || ''),
      category,
      route: 'godmode',
      targetTab: 'support',
      click_action: '/?tab=godmode',
      notificationTag: tag
    },
    webpush: { notification: { tag, renotify: false, icon: '/app-icon.png', badge: '/app-icon.png' }, fcmOptions: { link: '/?tab=godmode' } },
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
      cleanup.push((async () => {
        const userRef = db.collection('users').doc(record.userId);
        const snap = await userRef.get();
        const data = snap.exists ? (snap.data() || {}) : {};
        const pushDevices = data.pushDevices && typeof data.pushDevices === 'object' ? { ...data.pushDevices } : {};
        Object.keys(pushDevices).forEach(deviceId => {
          const deviceToken = typeof pushDevices[deviceId] === 'string' ? pushDevices[deviceId] : (pushDevices[deviceId]?.token || pushDevices[deviceId]?.fcmToken || '');
          if (deviceToken === record.token) delete pushDevices[deviceId];
        });
        const patch = {
          pushDevices,
          pushNeedsRepair: true,
          pushRepairFlaggedAt: new Date().toISOString(),
          lastPushFailureCode: code
        };
        if (data.fcmToken === record.token) patch.fcmToken = null;
        await userRef.set(patch, { merge: true });
      })());
    }
  });
  await Promise.allSettled(cleanup);
  return {
    attempted: true,
    fcmAcceptedCount: response.successCount,
    fcmRejectedCount: response.failureCount,
    sentCount: response.successCount,
    failedCount: response.failureCount,
    eligibleAdminCount: admins.length,
    tokenCount: tokenRecords.length,
    missingTokens: false,
    staleTokensCleaned: cleanup.length,
    deliveryConfirmedCount: 0,
    openedCount: 0,
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
    const crashFields = sanitizedCrashDiagnostics(body, req);
    const isAutomaticCrash = cleanCategory(body.category) === 'Crash / Error' || /crash|window_onerror|unhandledrejection|chunk/i.test(String(body.source || body.reportSource || ''));
    const report = {
      type: isAutomaticCrash ? 'automatic_crash_report' : 'user_reported_bug',
      category: cleanCategory(body.category),
      message: `${isAutomaticCrash ? 'AUTO CRASH REPORT' : 'USER REPORT'}: ${rawMessage}`,
      rawMessage,
      user: cleanText(caller.name || body.user || decoded.name || decoded.email || 'Unknown', 120),
      userId: caller.id || decoded.uid || '',
      userEmail: cleanText(caller.email || decoded.email || body.userEmail || '', 160),
      restaurantId,
      restaurantName: cleanText(body.restaurantName || caller.restaurantName || caller.restaurant || '', 160),
      activeTab: cleanText(body.activeTab || crashFields.tab || crashFields.route || 'help', 80),
      route: crashFields.route,
      userAgent: cleanText(body.userAgent || req.headers['user-agent'] || '', 500),
      screenSize: cleanText(body.screenSize || crashFields.viewport || '', 80),
      url: cleanText(body.url || crashFields.diagnostics?.url || '', 600),
      time: nowIso,
      createdAt: nowIso,
      status: 'new',
      source: isAutomaticCrash ? (crashFields.reportSource || 'automatic_crash_report') : 'help_center_report_problem',
      severity: isAutomaticCrash ? 'high' : 'standard',
      rawStack: crashFields.rawStack,
      componentStack: crashFields.componentStack,
      breadcrumbs: crashFields.breadcrumbs,
      diagnostics: crashFields.diagnostics,
      chunkUrl: crashFields.chunkUrl,
      appVersion: crashFields.appVersion,
      deploymentId: crashFields.deploymentId,
      online: crashFields.online,
      serviceWorkerState: crashFields.serviceWorkerState,
      errorName: crashFields.errorName,
      errorMessage: crashFields.errorMessage,
      supportPushRequested: true,
      supportPushAttemptedAt: nowIso,
      supportEmailRequested: isAutomaticCrash,
      supportEmailAttemptedAt: isAutomaticCrash ? nowIso : ''
    };

    const reportRef = await db.collection('crashReports').add(report);
    const pushResult = await sendSuperAdminPush(app, db, { ...report, reportId: reportRef.id }, caller).catch(error => ({
      attempted: true,
      fcmAcceptedCount: 0,
      fcmRejectedCount: 1,
      sentCount: 0,
      failedCount: 1,
      error: error.message || String(error),
      failures: [{ code: 'send_failed', message: error.message || String(error) }]
    }));

    const emailResult = report.supportEmailRequested ? await sendBugReportEmail({ report: { ...report, reportId: reportRef.id }, reporter: caller, reportId: reportRef.id }).catch(error => ({
      attempted: true,
      providerAccepted: false,
      provider: 'resend',
      failureCategory: 'send_failed',
      failureMessage: error?.message || String(error),
      attemptedAt: new Date().toISOString()
    })) : { attempted: false, providerAccepted: false };

    await reportRef.set({
      supportPushReportId: reportRef.id,
      supportPushFcmAcceptedCount: Number(pushResult.fcmAcceptedCount ?? pushResult.sentCount ?? 0),
      supportPushFcmRejectedCount: Number(pushResult.fcmRejectedCount ?? pushResult.failedCount ?? 0),
      supportPushSentCount: Number(pushResult.fcmAcceptedCount ?? pushResult.sentCount ?? 0),
      supportPushFailedCount: Number(pushResult.fcmRejectedCount ?? pushResult.failedCount ?? 0),
      supportPushDeliveryConfirmedCount: Number(pushResult.deliveryConfirmedCount || 0),
      supportPushOpenedCount: Number(pushResult.openedCount || 0),
      supportPushEligibleAdminCount: Number(pushResult.eligibleAdminCount || 0),
      supportPushTokenCount: Number(pushResult.tokenCount || 0),
      supportPushMissingTokens: pushResult.missingTokens === true,
      supportPushStaleTokensCleaned: Number(pushResult.staleTokensCleaned || 0),
      supportPushFailures: Array.isArray(pushResult.failures) ? pushResult.failures.slice(0, 10) : [],
      supportPushError: pushResult.error || '',
      supportPushCompletedAt: new Date().toISOString(),
      supportEmailAttempted: emailResult.attempted === true,
      supportEmailProviderAccepted: emailResult.providerAccepted === true,
      supportEmailProvider: emailResult.provider || '',
      supportEmailProviderMessageId: emailResult.providerMessageId || '',
      supportEmailFailureCategory: emailResult.failureCategory || '',
      supportEmailFailureMessage: cleanText(emailResult.failureMessage || '', 500),
      supportEmailAttemptedAt: emailResult.attemptedAt || new Date().toISOString()
    }, { merge: true });

    await db.collection('auditLogs').add({
      restaurantId: restaurantId || 'Unknown',
      action: 'BUG_REPORT_SUBMITTED',
      target: `crashReports/${reportRef.id}`,
      details: `${report.category} submitted from ${report.activeTab}. Super admin push accepted by FCM: ${pushResult.fcmAcceptedCount ?? pushResult.sentCount ?? 0}. Email accepted: ${emailResult.providerAccepted === true}.`,
      userId: caller.id || decoded.uid || '',
      userName: caller.name || decoded.email || 'Unknown user',
      userEmail: caller.email || decoded.email || '',
      timestamp: new Date().toISOString(),
      metadata: {
        category: report.category,
        activeTab: report.activeTab,
        supportPushFcmAcceptedCount: pushResult.fcmAcceptedCount ?? pushResult.sentCount ?? 0,
        supportPushFcmRejectedCount: pushResult.fcmRejectedCount ?? pushResult.failedCount ?? 0,
        supportPushEligibleAdminCount: pushResult.eligibleAdminCount || 0,
        supportPushMissingTokens: pushResult.missingTokens === true
      }
    }).catch(() => {});

    return res.status(200).json({
      ok: true,
      reportId: reportRef.id,
      push: {
        attempted: pushResult.attempted !== false,
        fcmAcceptedCount: pushResult.fcmAcceptedCount ?? pushResult.sentCount ?? 0,
        fcmRejectedCount: pushResult.fcmRejectedCount ?? pushResult.failedCount ?? 0,
        deliveryConfirmedCount: Number(pushResult.deliveryConfirmedCount || 0),
        openedCount: Number(pushResult.openedCount || 0),
        status: (pushResult.fcmAcceptedCount ?? pushResult.sentCount ?? 0) > 0 ? 'accepted_by_fcm_delivery_unconfirmed' : 'not_accepted'
      },
      email: {
        attempted: emailResult.attempted === true,
        providerAccepted: emailResult.providerAccepted === true,
        provider: emailResult.provider || '',
        providerMessageId: emailResult.providerMessageId || ''
      },
      supportPushFcmAcceptedCount: pushResult.fcmAcceptedCount ?? pushResult.sentCount ?? 0,
      supportPushFcmRejectedCount: pushResult.fcmRejectedCount ?? pushResult.failedCount ?? 0,
      supportPushEligibleAdminCount: pushResult.eligibleAdminCount || 0,
      supportPushMissingTokens: pushResult.missingTokens === true,
      supportEmailProviderAccepted: emailResult.providerAccepted === true,
      supportEmailAttempted: emailResult.attempted === true
    });
  } catch (error) {
    console.error('[report-bug] failed:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Failed to submit bug report.' });
  }
};
