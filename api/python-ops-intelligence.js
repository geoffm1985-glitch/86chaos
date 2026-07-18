const path = require('path');
const { spawn } = require('child_process');
const { initAdmin, authorize, requireAppCheckIfEnforced, readBody } = require('./_chaos-admin');

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

function runPythonOpsEngine(payload) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'python', 'ops_intelligence.py');
    const candidates = ['python3', 'python'];
    let candidateIndex = 0;
    const input = JSON.stringify(payload || {});
    if (Buffer.byteLength(input, 'utf8') > MAX_PAYLOAD_BYTES) {
      reject(new Error('Python ops payload is too large. Narrow the date window or reduce history.'));
      return;
    }

    const trySpawn = () => {
      const command = candidates[candidateIndex];
      const child = spawn(command, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { child.kill('SIGKILL'); } catch (_) {}
        reject(new Error('Python ops intelligence timed out.'));
      }, PYTHON_TIMEOUT_MS);

      child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); });
      child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
      child.on('error', err => {
        clearTimeout(timer);
        if (settled) return;
        if (/ENOENT/i.test(err?.code || err?.message || '') && candidateIndex < candidates.length - 1) {
          candidateIndex += 1;
          trySpawn();
          return;
        }
        settled = true;
        reject(new Error(`Python runtime unavailable: ${err.message}`));
      });
      child.on('close', code => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        if (code !== 0) {
          reject(new Error(stderr.trim() || stdout.trim() || `Python ops intelligence exited with ${code}.`));
          return;
        }
        try {
          resolve(JSON.parse(stdout || '{}'));
        } catch (err) {
          reject(new Error(`Python ops intelligence returned invalid JSON: ${err.message}`));
        }
      });
      child.stdin.write(input);
      child.stdin.end();
    };
    trySpawn();
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

    const payload = compactPayload(body);
    const result = await runPythonOpsEngine(payload);
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
