const crypto = require('crypto');
const { initAdmin, authorize, readBody, masterEmails, norm } = require('./_chaos-admin');
const { callPythonFunction } = require('./_python-function-client');
const { resolveWorkspaceSubscription, planIsAtLeast, PLAN_IDS } = require('./_plan-access');

const APP_VERSION = '15.0.89';
const PYTHON_TIMEOUT_MS = 35000;
const MAX_PAYLOAD_BYTES = 1500000;
const COLLECTION_LIMITS = {
  inventoryItems: 900,
  vendors: 250,
  wasteLogs: 700,
  invoices: 260,
  events: 260,
  prepItems: 600,
  menuDependencies: 1300,
  recipes: 300,
  users: 320,
  shifts: 1400,
  timePunches: 800,
  timeOffRequests: 500,
  availabilityRecords: 500,
  reminders: 700,
  tasks: 700,
  maintenanceLogs: 450,
  auditLogs: 550,
  backups: 150
};

const DEFAULT_JOBS = {
  nightlyOpsScan: true,
  morningManagerBrief: true,
  backupIntegrityCheck: true,
  dataHealthScanner: true,
  invoicePriceWatcher: true,
  eventSupplyRiskCheck: true,
  wastePatternScanner: true,
  parRecommendationEngine: true,
  recipeCostingRefresh: true,
  releaseDataQaScanner: true,
  criticalPushAlerts: true,
  approvalQueue: true
};

const SAFE_POLICY = {
  can: [
    'Analyze app data and create reports',
    'Create suggestions and approval-queue items',
    'Send critical push alerts for serious findings',
    'Create draft intelligence records for manager review',
    'Track run history, failures, and next actions'
  ],
  approvalRequired: [
    'Change par levels',
    'Save order drafts',
    'Mark items ordered',
    'Apply data repairs',
    'Update recipe/menu costs shown as official',
    'Archive or restore operational records'
  ],
  never: [
    'Send vendor orders automatically',
    'Spend money',
    'Edit or publish schedules',
    'Approve payroll or timesheets',
    'Change wages, permissions, billing, or security settings',
    'Delete records permanently',
    'Silently change inventory counts, availability, or request-offs'
  ]
};

function getCronSecret(req) {
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return auth || String(req.headers['x-cron-secret'] || '').trim();
}

function hashId(parts) {
  return crypto.createHash('sha1').update(parts.filter(Boolean).join('|')).digest('hex').slice(0, 32);
}

function dateKey(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function cleanText(value, max = 400) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
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
  return [...tokens].filter(Boolean);
}

async function runPythonOpsEngine(req, payload) {
  return callPythonFunction(req, '/api/python-ops-engine', payload, {
    caller: 'python-automation-run',
    timeoutMs: PYTHON_TIMEOUT_MS,
    maxPayloadBytes: MAX_PAYLOAD_BYTES,
    payloadError: 'Python automation payload is too large. Narrow the history window.'
  });
}

async function getCollectionRows(db, collectionName, restaurantId, limit = 200) {
  try {
    const snap = await db.collection(collectionName).where('restaurantId', '==', restaurantId).limit(limit).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    try {
      const snap = await db.collection(collectionName).where('workspaceId', '==', restaurantId).limit(limit).get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (_) {
      return [];
    }
  }
}

async function loadPayloadForRestaurant(db, restaurant) {
  const restaurantId = restaurant.id;
  const [inventoryItems, vendors, wasteLogs, invoices, events, prepItems, menuDependencies, recipes, users, shifts, timePunches, timeOffRequests, availabilityRecords, reminders, tasks, maintenanceLogs, auditLogs, backups] = await Promise.all([
    getCollectionRows(db, 'inventoryItems', restaurantId, COLLECTION_LIMITS.inventoryItems),
    getCollectionRows(db, 'vendors', restaurantId, COLLECTION_LIMITS.vendors),
    getCollectionRows(db, 'wasteLogs', restaurantId, COLLECTION_LIMITS.wasteLogs),
    getCollectionRows(db, 'invoices', restaurantId, COLLECTION_LIMITS.invoices),
    getCollectionRows(db, 'events', restaurantId, COLLECTION_LIMITS.events),
    getCollectionRows(db, 'prepItems', restaurantId, COLLECTION_LIMITS.prepItems),
    getCollectionRows(db, 'menuDependencies', restaurantId, COLLECTION_LIMITS.menuDependencies),
    getCollectionRows(db, 'recipes', restaurantId, COLLECTION_LIMITS.recipes),
    getCollectionRows(db, 'users', restaurantId, COLLECTION_LIMITS.users),
    getCollectionRows(db, 'shifts', restaurantId, COLLECTION_LIMITS.shifts),
    getCollectionRows(db, 'timePunches', restaurantId, COLLECTION_LIMITS.timePunches),
    getCollectionRows(db, 'timeOffRequests', restaurantId, COLLECTION_LIMITS.timeOffRequests),
    getCollectionRows(db, 'availabilityRecords', restaurantId, COLLECTION_LIMITS.availabilityRecords),
    getCollectionRows(db, 'reminders', restaurantId, COLLECTION_LIMITS.reminders),
    getCollectionRows(db, 'tasks', restaurantId, COLLECTION_LIMITS.tasks),
    getCollectionRows(db, 'maintenanceLogs', restaurantId, COLLECTION_LIMITS.maintenanceLogs),
    getCollectionRows(db, 'auditLogs', restaurantId, COLLECTION_LIMITS.auditLogs),
    getCollectionRows(db, 'backups', restaurantId, COLLECTION_LIMITS.backups)
  ]);
  let backupStatus = {};
  try {
    const status = await db.collection('system').doc('backupStatus').get();
    backupStatus = status.exists ? status.data() : {};
  } catch (_) {}
  return {
    restaurantId,
    currentDate: todayKey(),
    daysAhead: 14,
    inventoryItems,
    vendors,
    wasteLogs,
    invoices,
    events,
    prepItems,
    menuDependencies,
    recipes,
    users,
    shifts,
    timePunches,
    timeOffRequests,
    availabilityRecords,
    reminders,
    tasks,
    maintenanceLogs,
    auditLogs,
    backups,
    backupStatus,
    restaurantSnapshot: { id: restaurant.id, name: restaurant.name || restaurant.restaurantName || '', planId: restaurant.planId || restaurant.subscription?.planId || '' }
  };
}

function criticalFindingsFrom(result = {}) {
  const findings = [];
  (result.backupChecks || []).filter(row => row.status === 'attention').forEach(row => findings.push({ severity: 'critical', area: 'Backups', title: row.title || 'Backup needs attention', detail: row.detail || row.recommendation || '' }));
  (result.priceWatch || []).filter(row => Math.abs(Number(row.changePct || 0)) >= 20).slice(0, 6).forEach(row => findings.push({ severity: 'high', area: 'Invoices', title: `${row.itemName || 'Item'} price moved ${row.changePct}%`, detail: row.summary || '' }));
  (result.invoiceAnomalies || []).slice(0, 6).forEach(row => findings.push({ severity: 'high', area: 'Invoices', title: row.title || 'Invoice anomaly', detail: row.detail || '' }));
  (result.dataHealth || []).filter(row => String(row.severity || '').toLowerCase() === 'critical').slice(0, 8).forEach(row => findings.push({ severity: 'critical', area: row.area || 'Data Health', title: row.title || 'Critical data issue', detail: (row.issues || []).join(', ') }));
  (result.laborScheduleWarnings || []).filter(row => /pending request|outside availability|open punch|overlap/i.test(`${row.title || ''} ${row.detail || ''}`)).slice(0, 6).forEach(row => findings.push({ severity: 'medium', area: 'Labor/Schedule', title: row.title || 'Labor warning', detail: row.detail || '' }));
  return findings.slice(0, 25);
}

function makeRecommendations(restaurant, result = {}, runId, source) {
  const restaurantId = restaurant.id;
  const rows = [];
  const base = { restaurantId, workspaceId: restaurantId, restaurantName: restaurant.name || restaurant.restaurantName || '', runId, source, status: 'open', requiresApproval: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), safety: 'suggestion_only' };
  (result.parRecommendations || []).slice(0, 30).forEach(row => rows.push({ ...base, type: 'par_recommendation', title: `Review par for ${row.itemName || 'inventory item'}`, detail: row.reason || row.summary || `Suggested par: ${row.suggestedPar || row.recommendedPar || 'review'}`, payload: row }));
  (result.wastePatterns || []).slice(0, 25).forEach(row => rows.push({ ...base, type: 'waste_pattern', title: `Review waste pattern for ${row.itemName || row.title || 'item'}`, detail: row.recommendation || row.summary || row.detail || 'Review waste trend before changing prep or par.', payload: row }));
  (result.menuCosting || []).filter(row => ['high', 'medium'].includes(String(row.severity || '').toLowerCase())).slice(0, 25).forEach(row => rows.push({ ...base, type: 'menu_costing', title: `Review menu cost for ${row.recipeName || 'recipe'}`, detail: `Estimated cost $${Number(row.estimatedCost || 0).toFixed(2)}${row.foodCostPct ? ` • ${row.foodCostPct}% food cost` : ''}`, payload: row }));
  (result.dataHealth || []).slice(0, 25).forEach(row => rows.push({ ...base, type: 'data_health_repair', title: `${row.area || 'Data'}: ${row.title || 'Repair suggested'}`, detail: (row.issues || []).join(', ') || row.recommendation || 'Review before repairing data.', payload: row }));
  (result.invoiceAnomalies || []).slice(0, 20).forEach(row => rows.push({ ...base, type: 'invoice_review', title: row.title || 'Invoice needs review', detail: row.detail || 'Review invoice before acting.', payload: row }));
  (result.laborScheduleWarnings || []).slice(0, 20).forEach(row => rows.push({ ...base, type: 'labor_schedule_review', title: row.title || 'Labor or schedule review', detail: row.detail || 'Review before changing records.', payload: row }));
  return rows;
}

async function writeRecommendations(db, restaurant, result, runId, source) {
  const rows = makeRecommendations(restaurant, result, runId, source);
  let written = 0;
  for (const row of rows) {
    const id = hashId([row.restaurantId, row.type, row.title, dateKey(row.createdAt)]);
    const ref = db.collection('aiRecommendationQueue').doc(id);
    const snap = await ref.get().catch(() => null);
    if (snap?.exists && ['approved', 'dismissed', 'completed'].includes(String(snap.data()?.status || '').toLowerCase())) continue;
    await ref.set({ ...row, id, lastSeenAt: new Date().toISOString(), seenCount: (Number(snap?.data()?.seenCount || 0) + 1) }, { merge: true });
    written += 1;
  }
  return { written, considered: rows.length };
}

async function loadAlertRecipients(db, restaurantId) {
  const users = new Map();
  const add = docSnap => { if (docSnap?.exists) users.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }); };
  await Promise.allSettled([
    db.collection('users').where('isSuperAdmin', '==', true).limit(100).get().then(snap => snap.forEach(add)),
    db.collection('users').where('systemAccess.superAdmin', '==', true).limit(100).get().then(snap => snap.forEach(add)),
    db.collection('users').where('restaurantId', '==', restaurantId).limit(250).get().then(snap => snap.forEach(add))
  ]);
  await Promise.allSettled(masterEmails().slice(0, 25).map(async email => {
    const snap = await db.collection('users').where('email', '==', norm(email)).limit(5).get();
    snap.forEach(add);
  }));
  return [...users.values()].filter(user => user?.isActive !== false && user?.disabled !== true && (user.isSuperAdmin === true || user.systemAccess?.superAdmin === true || user.isOwner === true || user.accountOwner === true || user.workspaceOwner === true || user.isAdmin === true));
}

async function sendCriticalPush(app, db, restaurant, criticalFindings, runId) {
  if (!criticalFindings.length) return { attempted: false, sentCount: 0, failedCount: 0, tokenCount: 0 };
  const recipients = await loadAlertRecipients(db, restaurant.id);
  const tokens = [];
  const seen = new Set();
  recipients.forEach(user => collectTokens(user).forEach(token => { if (!seen.has(token)) { seen.add(token); tokens.push(token); } }));
  if (!tokens.length) return { attempted: true, sentCount: 0, failedCount: 0, tokenCount: 0, missingTokens: true, eligibleRecipientCount: recipients.length };
  const top = criticalFindings[0];
  const payloadBase = {
    notification: {
      title: `86 Chaos Python alert: ${restaurant.name || restaurant.id}`.slice(0, 100),
      body: `${top.area}: ${top.title}`.slice(0, 240)
    },
    data: { type: 'python_ops_alert', route: 'godmode', targetTab: 'automation', runId: String(runId), restaurantId: String(restaurant.id) }
  };
  let sentCount = 0;
  let failedCount = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const response = await app.messaging().sendEachForMulticast({ ...payloadBase, tokens: tokens.slice(i, i + 500) });
    sentCount += response.successCount || 0;
    failedCount += response.failureCount || 0;
  }
  return { attempted: true, sentCount, failedCount, tokenCount: tokens.length, eligibleRecipientCount: recipients.length };
}

async function shouldRunRestaurant(db, restaurant, requestedMode) {
  const ref = db.collection('pythonAutomationConfigs').doc(restaurant.id);
  const snap = await ref.get().catch(() => null);
  const config = snap?.exists ? snap.data() : {};
  const jobs = { ...DEFAULT_JOBS, ...(config.jobs || {}) };
  const paused = config.paused === true || jobs.nightlyOpsScan === false;
  if (requestedMode === 'manual') return { run: true, config: { ...config, jobs, paused } };
  if (paused) return { run: false, reason: 'paused', config: { ...config, jobs, paused } };
  return { run: true, config: { ...config, jobs, paused } };
}


function compactResultForStorage(result = {}) {
  return {
    ok: result.ok !== false,
    engine: result.engine || 'python-ops-intelligence',
    version: result.version || '',
    generatedAt: result.generatedAt || '',
    currentDate: result.currentDate || '',
    summary: result.summary || {},
    managerBrief: (result.managerBrief || []).slice(0, 12),
    priceWatch: (result.priceWatch || []).slice(0, 25),
    invoiceAnomalies: (result.invoiceAnomalies || []).slice(0, 25),
    parRecommendations: (result.parRecommendations || []).slice(0, 30),
    wastePatterns: (result.wastePatterns || []).slice(0, 25),
    menuCosting: (result.menuCosting || []).slice(0, 25),
    laborScheduleWarnings: (result.laborScheduleWarnings || []).slice(0, 25),
    dataHealth: (result.dataHealth || []).slice(0, 30),
    backupChecks: (result.backupChecks || []).slice(0, 12),
    reports: {
      text: String(result.reports?.text || '').slice(0, 30000),
      csv: String(result.reports?.csv || '').slice(0, 30000)
    }
  };
}

async function processRestaurant({ app, db, restaurant, source, requestedMode }) {
  const runId = `pyauto_${restaurant.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date().toISOString();
  const gate = await shouldRunRestaurant(db, restaurant, requestedMode);
  if (!gate.run) {
    return { restaurantId: restaurant.id, restaurantName: restaurant.name || '', skipped: true, reason: gate.reason || 'not_due' };
  }
  const runRef = db.collection('pythonAutomationRuns').doc(runId);
  await runRef.set({ id: runId, restaurantId: restaurant.id, workspaceId: restaurant.id, restaurantName: restaurant.name || '', source, requestedMode, status: 'running', startedAt, appVersion: APP_VERSION, jobs: gate.config.jobs, safetyPolicy: SAFE_POLICY }, { merge: true });
  try {
    const payload = await loadPayloadForRestaurant(db, restaurant);
    const result = await runPythonOpsEngine(req, payload);
    const criticalFindings = criticalFindingsFrom(result);
    const reportRef = db.collection('opsIntelligenceReports').doc(runId);
    const queueStats = gate.config.jobs?.approvalQueue === false ? { written: 0, considered: 0, disabled: true } : await writeRecommendations(db, restaurant, result, runId, source);
    const pushResult = gate.config.jobs?.criticalPushAlerts === false ? { attempted: false, disabled: true, sentCount: 0, failedCount: 0 } : await sendCriticalPush(app, db, restaurant, criticalFindings, runId).catch(error => ({ attempted: true, sentCount: 0, failedCount: 1, error: error.message || String(error) }));
    const finishedAt = new Date().toISOString();
    const summary = result.summary || {};
    await reportRef.set({
      id: runId,
      runId,
      restaurantId: restaurant.id,
      workspaceId: restaurant.id,
      restaurantName: restaurant.name || restaurant.restaurantName || '',
      source,
      generatedAt: result.generatedAt || finishedAt,
      createdAt: finishedAt,
      status: criticalFindings.some(f => f.severity === 'critical') ? 'critical' : criticalFindings.length ? 'attention' : 'ok',
      summary,
      managerBrief: result.managerBrief || [],
      criticalFindings,
      result: compactResultForStorage(result),
      queueStats,
      pushResult,
      safetyPolicy: SAFE_POLICY,
      appVersion: APP_VERSION
    }, { merge: true });
    await runRef.set({ status: 'completed', finishedAt, summary, reportId: reportRef.id, criticalFindingCount: criticalFindings.length, queueStats, pushResult }, { merge: true });
    await db.collection('pythonAutomationConfigs').doc(restaurant.id).set({
      restaurantId: restaurant.id,
      workspaceId: restaurant.id,
      restaurantName: restaurant.name || restaurant.restaurantName || '',
      jobs: gate.config.jobs,
      paused: gate.config.paused === true,
      lastRunAt: finishedAt,
      lastRunId: runId,
      lastStatus: criticalFindings.length ? 'attention' : 'ok',
      nextRunHint: source === 'manual' ? 'Next scheduled nightly run' : 'Tomorrow morning',
      updatedAt: finishedAt
    }, { merge: true });
    await db.collection('auditLogs').add({ restaurantId: restaurant.id, action: 'PYTHON_AUTOMATION_RUN', target: `opsIntelligenceReports/${runId}`, details: `Python Automation completed with ${criticalFindings.length} critical/attention finding(s) and ${queueStats.written || 0} approval queue item(s).`, userId: source, userName: source === 'cron' ? 'Vercel Cron' : 'System Administrator', timestamp: finishedAt, source: 'python_automation_center' }).catch(() => null);
    return { restaurantId: restaurant.id, restaurantName: restaurant.name || '', ok: true, runId, status: criticalFindings.length ? 'attention' : 'ok', summary, criticalFindingCount: criticalFindings.length, queueItemsWritten: queueStats.written || 0, pushSentCount: pushResult.sentCount || 0 };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    await runRef.set({ status: 'failed', finishedAt, error: error.message || String(error) }, { merge: true });
    await db.collection('opsIntelligenceReports').doc(runId).set({ id: runId, runId, restaurantId: restaurant.id, workspaceId: restaurant.id, restaurantName: restaurant.name || '', source, createdAt: finishedAt, generatedAt: finishedAt, status: 'failed', error: error.message || String(error), summary: {}, managerBrief: [`Python automation failed: ${error.message || error}`], criticalFindings: [{ severity: 'critical', area: 'Python Automation', title: 'Automation failed', detail: error.message || String(error) }], appVersion: APP_VERSION }, { merge: true });
    return { restaurantId: restaurant.id, restaurantName: restaurant.name || '', ok: false, runId, error: error.message || String(error) };
  }
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  let app;
  try { app = initAdmin(req); }
  catch (error) { return res.status(503).json({ ok: false, error: `Firebase Admin unavailable: ${error.message}` }); }
  const db = app.firestore();

  let source = 'manual';
  let requestedMode = 'manual';
  let ctx = null;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && getCronSecret(req) === cronSecret) {
    source = 'cron';
    requestedMode = 'scheduled';
  } else {
    ctx = await authorize(req, app, { allowCrossProjectMaster: true });
    const ctxEmail = norm(ctx.email || ctx.decoded?.email || '');
    const ctxSuperAdmin = ctx.isSuperAdmin === true || ctx.decoded?.superAdmin === true || ctx.decoded?.systemAccess?.superAdmin === true || masterEmails().includes(ctxEmail);
    if (!ctx.ok || !ctxSuperAdmin) return res.status(ctx.status || 403).json({ ok: false, error: ctx.error || 'System Administrator access is required.' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, version: APP_VERSION, source, defaultJobs: DEFAULT_JOBS, safetyPolicy: SAFE_POLICY, message: 'Use POST to run Python Automation Center jobs.' });
  }

  const body = source === 'cron' ? {} : await readBody(req);
  const targetRestaurantId = cleanText(body.restaurantId || '', 160);
  const maxRestaurants = Math.max(1, Math.min(Number(body.maxRestaurants || process.env.PYTHON_AUTOMATION_MAX_RESTAURANTS || 8), 30));
  let restaurants = [];
  if (targetRestaurantId) {
    const snap = await db.collection('restaurants').doc(targetRestaurantId).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: 'Restaurant not found.' });
    restaurants = [{ id: snap.id, ...snap.data() }];
  } else {
    const snap = await db.collection('restaurants').where('isActive', '==', true).limit(maxRestaurants).get();
    restaurants = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(r => r.isReadOnly !== true && r.deleted !== true);
  }

  const results = [];
  for (const restaurant of restaurants) {
    const subscription = resolveWorkspaceSubscription(restaurant, {}, {});
    if (!planIsAtLeast(subscription.planId, PLAN_IDS.SMART_KITCHEN)) {
      results.push({ restaurantId: restaurant.id, restaurantName: restaurant.name || '', ok: true, skipped: true, reason: 'smart_kitchen_required', detail: 'Python automation is limited to Smart Kitchen and higher.' });
      continue;
    }
    results.push(await processRestaurant({ app, db, restaurant, source, requestedMode }));
  }
  return res.status(200).json({ ok: true, version: APP_VERSION, source, requestedMode, restaurantCount: restaurants.length, results, safetyPolicy: SAFE_POLICY });
};

module.exports.config = { maxDuration: 300 };
