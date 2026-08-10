#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

const requiredFiles = [
  'api/_python-function-client.js',
  'api/python-ops-intelligence.js',
  'api/python-order-intelligence.js',
  'api/python-automation-run.js',
  'api/python-ops-engine.py',
  'api/python-order-engine.py',
  'scripts/python/ops_intelligence.py',
  'scripts/python/order_intelligence.py',
  'requirements.txt'
];

const checks = [];
const add = (name, pass) => checks.push({ name, pass: Boolean(pass) });
for (const file of requiredFiles) add(`${file} exists`, exists(file));

const vercel = JSON.parse(read('vercel.json'));
function functionRuleFor(file) {
  const functions = vercel.functions || {};
  if (functions[file]) return functions[file];
  const ext = path.extname(file).replace(/^\./, '');
  for (const [pattern, rule] of Object.entries(functions)) {
    if (pattern === `api/**/*.${ext}` && file.startsWith('api/') && file.endsWith(`.${ext}`)) return rule;
  }
  return null;
}
add('Vercel cron includes Python Automation Run', (vercel.crons || []).some(c => c.path === '/api/python-automation-run'));
for (const file of ['api/python-ops-intelligence.js','api/python-order-intelligence.js','api/python-automation-run.js']) {
  const rule = functionRuleFor(file);
  add(`Vercel function rule covers ${file}`, Boolean(rule));
  add(`Vercel JS wildcard/current rule gives ${file} required maxDuration`, Number(rule?.maxDuration || 0) >= 300);
  add(`Vercel JS wildcard/current rule gives ${file} required memory`, Number(rule?.memory || 0) >= 1024);
}
for (const file of ['api/python-ops-engine.py','api/python-order-engine.py']) {
  const rule = functionRuleFor(file);
  add(`Vercel function rule covers ${file}`, Boolean(rule));
  add(`Vercel Python wildcard/current rule gives ${file} required maxDuration`, Number(rule?.maxDuration || 0) >= 60);
  add(`Vercel Python wildcard/current rule gives ${file} required memory`, Number(rule?.memory || 0) >= 512);
}

const opsWrapper = read('api/python-ops-intelligence.js');
const orderWrapper = read('api/python-order-intelligence.js');
const client = read('api/_python-function-client.js');
const opsEngine = read('api/python-ops-engine.py');
const orderEngine = read('api/python-order-engine.py');
add('Ops wrapper calls Python ops engine', opsWrapper.includes("'/api/python-ops-engine'"));
add('Order wrapper calls Python order engine', orderWrapper.includes("'/api/python-order-engine'"));
add('Internal client requires CRON_SECRET or PYTHON_INTERNAL_SECRET', client.includes('PYTHON_INTERNAL_SECRET') && client.includes('CRON_SECRET'));
add('Ops engine imports ops_intelligence script', opsEngine.includes('import ops_intelligence'));
add('Order engine imports order_intelligence script', orderEngine.includes('import order_intelligence'));
add('Health checks can require Python routes', read('api/health-checks.js').includes("'python-ops-intelligence.js'") && read('api/health-checks.js').includes("'python-automation-run.js'"));
add('Manager Brief points to restored Ops endpoint', read('src/features/operations.jsx').includes("secureFetch('/api/python-ops-intelligence'"));
add('Inventory points to restored Order endpoint', read('src/features/inventory.jsx').includes("secureFetch('/api/python-order-intelligence'"));

let failed = false;
for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
  if (!check.pass) failed = true;
}
process.exit(failed ? 1 : 0);
