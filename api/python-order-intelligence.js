const { initAdmin, authorize, requireAppCheckIfEnforced, readBody } = require('./_chaos-admin');
const { callPythonFunction } = require('./_python-function-client');

const MAX_PAYLOAD_BYTES = 900000;
const PYTHON_TIMEOUT_MS = 20000;

const trimArray = (value, limit) => Array.isArray(value) ? value.slice(0, limit) : [];

function compactPayload(body = {}) {
  return {
    restaurantId: body.restaurantId || body.workspaceId || '',
    currentDate: body.currentDate || '',
    daysAhead: Math.max(1, Math.min(30, Number(body.daysAhead || 7))),
    eventDaysAhead: Math.max(1, Math.min(60, Number(body.eventDaysAhead || 21))),
    inventoryItems: trimArray(body.inventoryItems, 600),
    vendors: trimArray(body.vendors, 200),
    wasteLogs: trimArray(body.wasteLogs, 400),
    invoices: trimArray(body.invoices, 180),
    events: trimArray(body.events, 240),
    prepItems: trimArray(body.prepItems, 400),
    menuDependencies: trimArray(body.menuDependencies, 800)
  };
}

async function runPythonOrderEngine(req, payload) {
  return callPythonFunction(req, '/api/python-order-engine', payload, {
    caller: 'python-order-intelligence',
    timeoutMs: PYTHON_TIMEOUT_MS,
    maxPayloadBytes: MAX_PAYLOAD_BYTES,
    payloadError: 'Python order payload is too large. Narrow the date window or reduce history.'
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
    const canUseInventory = ctx.isSuperAdmin || ctx.user?.isAdmin || ctx.user?.isOwner || ctx.permissions?.inventory === true || ctx.permissions?.team === true;
    if (!canUseInventory) return res.status(403).json({ ok: false, error: 'Inventory permission is required for Python order intelligence.' });

    const payload = compactPayload(body);
    const result = await runPythonOrderEngine(req, payload);
    const ok = result?.ok !== false;
    await ctx.db.collection('auditLogs').add({
      restaurantId,
      action: 'PYTHON_ORDER_INTELLIGENCE_RUN',
      target: 'api/python-order-intelligence',
      details: ok ? `Python order intelligence generated ${result?.summary?.forecastCount || 0} forecasts, ${result?.summary?.priceWarningCount || 0} price warnings, and ${result?.summary?.eventSupplyCount || 0} event supply signals.` : `Python order intelligence returned an error: ${result?.error || 'unknown'}`,
      userId: ctx.userDocId || ctx.uid || '',
      userName: ctx.user?.name || ctx.email || 'Inventory User',
      timestamp: new Date().toISOString(),
      source: 'python_order_intelligence'
    }).catch(() => null);
    return res.status(ok ? 200 : 500).json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, engine: 'python-order-intelligence', error: err.message });
  }
};

module.exports.config = { maxDuration: 60 };
