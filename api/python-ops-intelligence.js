const { initAdmin, authorize, requireAppCheckIfEnforced, readBody } = require('./_chaos-admin');
const { callPythonFunction } = require('./_python-function-client');
const { resolveWorkspaceSubscription, planIsAtLeast, PLAN_IDS } = require('./_plan-access');

const MAX_PAYLOAD_BYTES = 1200000;
const PYTHON_TIMEOUT_MS = 25000;

const trimArray = (value, limit) => Array.isArray(value) ? value.slice(0, limit) : [];

function compactPayload(body = {}) {
  return {
    restaurantId: body.restaurantId || body.workspaceId || '',
    currentDate: body.currentDate || '',
    daysAhead: Math.max(3, Math.min(30, Number(body.daysAhead || 7))),
    inventoryItems: trimArray(body.inventoryItems, 800),
    vendors: trimArray(body.vendors, 250),
    wasteLogs: trimArray(body.wasteLogs, 600),
    invoices: trimArray(body.invoices, 240),
    events: trimArray(body.events, 240),
    prepItems: trimArray(body.prepItems, 500),
    menuDependencies: trimArray(body.menuDependencies, 1200),
    recipes: trimArray(body.recipes, 240),
    users: trimArray(body.users, 260),
    shifts: trimArray(body.shifts, 1200),
    timePunches: trimArray(body.timePunches, 650),
    timeOffRequests: trimArray(body.timeOffRequests, 350),
    availabilityRecords: trimArray(body.availabilityRecords, 350),
    reminders: trimArray(body.reminders, 600),
    tasks: trimArray(body.tasks, 600),
    maintenanceLogs: trimArray(body.maintenanceLogs, 350),
    auditLogs: trimArray(body.auditLogs, 450),
    backups: trimArray(body.backups, 120),
    backupStatus: body.backupStatus || {}
  };
}

async function runPythonOpsEngine(req, payload) {
  return callPythonFunction(req, '/api/python-ops-engine', payload, {
    caller: 'python-ops-intelligence',
    timeoutMs: PYTHON_TIMEOUT_MS,
    maxPayloadBytes: MAX_PAYLOAD_BYTES,
    payloadError: 'Python ops payload is too large. Narrow the date window or reduce history.'
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  try {
    const body = await readBody(req);
    const restaurantId = String(body.restaurantId || body.workspaceId || '').trim();
    if (!restaurantId) return res.status(400).json({ ok: false, error: 'restaurantId is required.' });
    const app = initAdmin(req);
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
    const ctx = await authorize(req, app, { allowTenantAdmin: true, targetRestaurantId: restaurantId });
    if (!ctx.ok) return res.status(ctx.status || 403).json({ ok: false, error: ctx.error || 'Not authorized.' });
    const canUseOpsIntel = ctx.isSuperAdmin || ctx.user?.isAdmin || ctx.user?.isOwner || ctx.permissions?.inventory === true || ctx.permissions?.sales === true || ctx.permissions?.team === true || ctx.permissions?.labor === true;
    if (!canUseOpsIntel) return res.status(403).json({ ok: false, error: 'Owner, manager, inventory, labor, sales, or team permission is required for Python Ops Intelligence.' });

    const restSnap = await ctx.db.collection('restaurants').doc(restaurantId).get();
    const workspace = restSnap.exists ? { id: restSnap.id, ...restSnap.data() } : {};
    const subscription = resolveWorkspaceSubscription(workspace, ctx.decoded || {}, ctx.user || {});
    if (!ctx.isSuperAdmin && !planIsAtLeast(subscription.planId, PLAN_IDS.SMART_KITCHEN)) {
      return res.status(403).json({ ok: false, code: 'PLAN_FEATURE_LOCKED', error: 'Python Ops Intelligence starts with Smart Kitchen. Ask an owner or System Administrator to review Plan & Billing.' });
    }

    const payload = compactPayload(body);
    const result = await runPythonOpsEngine(req, payload);
    const ok = result?.ok !== false;
    await ctx.db.collection('auditLogs').add({
      restaurantId,
      action: 'PYTHON_OPS_INTELLIGENCE_RUN',
      target: 'api/python-ops-intelligence',
      details: ok ? `Python Ops Intelligence generated ${result?.summary?.dataHealthCount || 0} data health issues, ${result?.summary?.laborWarningCount || 0} labor warnings, ${result?.summary?.menuCostCount || 0} menu cost checks, and ${result?.summary?.backupCheckCount || 0} backup checks.` : `Python Ops Intelligence returned an error: ${result?.error || 'unknown'}`,
      userId: ctx.userDocId || ctx.uid || '',
      userName: ctx.user?.name || ctx.email || 'Ops User',
      timestamp: new Date().toISOString(),
      source: 'python_ops_intelligence'
    }).catch(() => null);
    return res.status(ok ? 200 : 500).json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, engine: 'python-ops-intelligence', error: err.message });
  }
};

module.exports.config = { maxDuration: 60 };
