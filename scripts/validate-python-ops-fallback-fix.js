#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const checks = [];
const add = (name, pass) => checks.push({ name, pass: Boolean(pass) });
add('Ops fallback helper exists', exists('api/_ops-intelligence-fallback.js'));
const fallback = read('api/_ops-intelligence-fallback.js');
const opsRoute = read('api/python-ops-intelligence.js');
const client = read('api/_python-function-client.js');
const opsUi = read('src/features/operations.jsx');
add('Fallback helper exports buildFallbackOpsResult', fallback.includes('buildFallbackOpsResult'));
add('Fallback returns ok true instead of crashing Manager Brief', fallback.includes('ok: true') && fallback.includes('node-safe-fallback'));
add('Ops route imports fallback helper', opsRoute.includes('buildFallbackOpsResult'));
add('Ops route catches Python engine failures', opsRoute.includes('catch (engineError)') && opsRoute.includes('buildFallbackOpsResult(payload, engineError)'));
add('Python function client stringifies object errors', client.includes('safeErrorMessage') && client.includes('JSON.stringify(error)'));
add('Manager Brief UI stringifies object errors', opsUi.includes('readableApiError') && !opsUi.includes("throw new Error(payload?.error || 'Python Ops Intelligence failed.')"));
let failed = false;
for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
  if (!check.pass) failed = true;
}
process.exit(failed ? 1 : 0);
