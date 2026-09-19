#!/usr/bin/env node
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const REQUIRED = [
  'owner-today','recipes','operations-center','staff-my-schedule','manager-schedule-builder','staff-time-off','staff-availability','personal-reminders','system-admin-overview','bug-ledger','audit-logs','background-return','select-active-workspace','unchanged-push-token'
];
function fail(message, extra = {}) { console.error(JSON.stringify({ ok:false, error:message, ...extra }, null, 2)); process.exit(1); }
function safeHost(host = '', label = 'emulator') { const text = String(host || '').toLowerCase(); if (!/(localhost|127\.0\.0\.1|\[::1\])/.test(text)) fail(`${label} must be a local emulator host. Refusing ${host}`); }
function ping(host) { return new Promise(resolve => { const [hostname, port] = String(host).replace(/^https?:\/\//,'').split(':'); const req = http.request({ hostname, port:Number(port), path:'/', method:'GET', timeout:1500 }, res => { res.resume(); resolve(true); }); req.on('error',()=>resolve(false)); req.on('timeout',()=>{req.destroy();resolve(false);}); req.end(); }); }
function loadJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function sum(rows = [], key = '') { return rows.reduce((n,row)=>n+Number(row?.[key] || 0), 0); }
function listenerCount(report, pattern) { return Object.keys(report.activeListenerKeys || report.listeners || {}).filter(key => pattern.test(key)).length; }
function normalizeScenario(name, before, after) {
  const b = before?.totals || before || {};
  const a = after?.totals || after || {};
  return {
    name,
    startingDiagnostics: b,
    endingDiagnostics: a,
    delta: {
      listenerCreations: Number(a.listenerCreations || a.activeListeners || 0) - Number(b.listenerCreations || b.activeListeners || 0),
      listenerReuses: Number(a.listenerReuses || a.listenerReuseCount || 0) - Number(b.listenerReuses || b.listenerReuseCount || 0),
      initialDocuments: Number(a.initialDocuments || a.documentsReceivedInitial || 0) - Number(b.initialDocuments || b.documentsReceivedInitial || 0),
      documentChanges: Number(a.documentChanges || a.documentsReceivedChanges || 0) - Number(b.documentChanges || b.documentsReceivedChanges || 0),
      writesCompleted: Number(a.writesCompleted || 0) - Number(b.writesCompleted || 0),
      auditWrites: Number(a.auditWrites || a.auditWritesCreated || 0) - Number(b.auditWrites || b.auditWritesCreated || 0),
      skippedNoOpWrites: Number(a.skippedNoOpWrites || 0) - Number(b.skippedNoOpWrites || 0)
    },
    activeListenerKeys: Object.keys(after?.listeners || after?.activeListenerKeys || {})
  };
}
async function verifyEmulators() {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST;
  if (!firestoreHost) fail('FIRESTORE_EMULATOR_HOST is required for cost regression tests.');
  safeHost(firestoreHost, 'FIRESTORE_EMULATOR_HOST');
  if (storageHost) safeHost(storageHost, 'STORAGE_EMULATOR_HOST');
  if (!(await ping(firestoreHost))) fail(`Firestore emulator is not reachable at ${firestoreHost}`);
  if (storageHost && !(await ping(storageHost))) fail(`Storage emulator is not reachable at ${storageHost}`);
}
async function maybeRunPlaywrightCapture() {
  if (process.env.CHAOS_COST_CAPTURE_PLAYWRIGHT !== 'true') return;
  const missing = ['APP_URL','OWNER_EMAIL','OWNER_PASSWORD','MANAGER_EMAIL','MANAGER_PASSWORD','STAFF_EMAIL','STAFF_PASSWORD','SYSTEM_ADMIN_EMAIL','SYSTEM_ADMIN_PASSWORD','CHAOS_QA_RESTAURANT_ID'].filter(k => !process.env[k]);
  if (missing.length) fail('Playwright cost capture requires release QA credentials.', { missing });
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--no-install','playwright','test','tests/e2e/cost-regression.spec.cjs'], { cwd: root, stdio: 'inherit', env: { ...process.env, CHAOS_RELEASE_GATE: 'true' } });
  if (result.status !== 0) fail('Playwright cost capture failed.', { status: result.status });
}
function readScenarioReports(dir) {
  const rows = [];
  for (const name of REQUIRED) {
    const file = path.join(dir, `${name}.json`);
    if (!fs.existsSync(file)) fail(`Missing per-scenario cost diagnostics file: ${file}`);
    const report = loadJson(file);
    if (!report.before || !report.after) fail(`Scenario ${name} must include before and after diagnostics.`);
    rows.push(normalizeScenario(name, report.before, report.after));
  }
  return rows;
}
function assertScenarios(rows) {
  const byName = Object.fromEntries(rows.map(r => [r.name, r]));
  const failures = [];
  const pushFail = (name,msg,extra={}) => failures.push({ scenario:name, message:msg, ...extra });
  const recipes = byName['recipes'];
  if (recipes.activeListenerKeys.some(k => /users|workspaceMembers/.test(k) && /full|list|team|roster/i.test(k))) pushFail('recipes','Recipes must not open full roster/workspaceMembers listeners.', { keys: recipes.activeListenerKeys });
  const opsInventory = byName['operations-center'].activeListenerKeys.filter(k => /inventoryItems/.test(k));
  if (opsInventory.length !== 1) pushFail('operations-center','Operations Center must have exactly one inventory listener.', { opsInventory });
  if (!byName['staff-my-schedule'].activeListenerKeys.some(k => /scheduleUserId/.test(k)) || byName['staff-my-schedule'].activeListenerKeys.some(k => /shifts/.test(k) && !/scheduleUserId/.test(k))) pushFail('staff-my-schedule','Staff My Schedule must be scheduleUserId-scoped and must not open full restaurant shifts.');
  if (byName['staff-time-off'].activeListenerKeys.some(k => /timeOffRequests/.test(k) && !/userId/.test(k))) pushFail('staff-time-off','Staff Time Off must be user-scoped.');
  if (byName['system-admin-overview'].activeListenerKeys.some(k => /auditLogs|crashReports|users/.test(k) && /history|full|all/i.test(k))) pushFail('system-admin-overview','Overview must not open full histories.');
  if (byName['select-active-workspace'].delta.writesCompleted !== 0) pushFail('select-active-workspace','Selecting the active workspace must write zero documents.', { delta: byName['select-active-workspace'].delta });
  if (byName['unchanged-push-token'].delta.writesCompleted !== 0) pushFail('unchanged-push-token','Unchanged push token/status must write zero documents.', { delta: byName['unchanged-push-token'].delta });
  if (byName['background-return'].delta.listenerCreations > 1) pushFail('background-return','Brief background return should not recreate all initial listeners.', { delta: byName['background-return'].delta });
  if (failures.length) fail('Cost regression assertions failed.', { failures, scenarios: rows });
}
async function main() {
  await verifyEmulators();
  await maybeRunPlaywrightCapture();
  const dir = process.env.CHAOS_COST_SCENARIO_REPORT_DIR || path.join(root, 'test-results', 'cost-scenarios');
  if (!fs.existsSync(dir)) fail(`Cost regression requires per-scenario diagnostics in ${dir}. Run with CHAOS_COST_CAPTURE_PLAYWRIGHT=true or provide real exported reports.`);
  const scenarios = readScenarioReports(dir);
  assertScenarios(scenarios);
  const report = { ok:true, generatedAt:new Date().toISOString(), scenarioCount:scenarios.length, scenarios, totals: scenarios.reduce((acc,row)=>{ for (const [k,v] of Object.entries(row.delta)) acc[k]=(acc[k]||0)+Number(v||0); return acc; }, {}) };
  const outDir = path.join(root, 'test-results'); fs.mkdirSync(outDir, { recursive:true });
  fs.writeFileSync(path.join(outDir, 'firebase-cost-regression-report.json'), JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(outDir, 'firebase-cost-regression-summary.txt'), scenarios.map(s => `${s.name}: ${JSON.stringify(s.delta)}`).join('\n'));
  console.log(JSON.stringify(report, null, 2));
}
main().catch(err => fail(err.message || String(err), { stack: err.stack }));
