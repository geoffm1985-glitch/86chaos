#!/usr/bin/env node
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '..');
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')); }
function fail(msg) { console.error(`LOCK INTEGRITY FAIL: ${msg}`); failures += 1; }
let failures = 0;
const nodeMajor = Number(String(process.versions.node || '').split('.')[0]);
if (nodeMajor !== 24) fail(`Node 24.x is required for release validation. Detected ${process.versions.node}`);
const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const packages = lock.packages || {};
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
for (const name of Object.keys(deps).sort()) {
  if (!packages[`node_modules/${name}`]) fail(`${name} is declared in package.json but missing from package-lock.json packages[node_modules/${name}]`);
}
const executablePackages = {
  playwright: '@playwright/test',
  firebase: 'firebase-tools',
  eslint: 'eslint',
  'react-scripts': 'react-scripts'
};
for (const [scriptName, script] of Object.entries(pkg.scripts || {})) {
  for (const [exe, dep] of Object.entries(executablePackages)) {
    const re = new RegExp(`(^|[;&|\\s])${exe}(\\s|$)`);
    if (re.test(script) && !packages[`node_modules/${dep}`]) fail(`script ${scriptName} references ${exe}, but ${dep} is not locked`);
  }
  if (/npx\s+(?!--no-install)/.test(script)) fail(`script ${scriptName} uses npx without --no-install`);
}
for (const dir of ['tests/e2e']) {
  const full = path.join(root, dir);
  const tests = fs.existsSync(full) ? fs.readdirSync(full).filter(f => /\.(spec|test)\.(cjs|js|jsx)$/.test(f)) : [];
  if (!tests.length) fail(`${dir} contains zero tests`);
}
if (process.env.CHAOS_VERIFY_LOCK_AFTER_NPM_CI === 'true') {
  const before = cp.execFileSync('git', ['diff', '--', 'package-lock.json'], { cwd: root, encoding: 'utf8' }).trim();
  if (before) fail('package-lock.json has uncommitted changes before npm ci verification');
}
if (failures) process.exit(1);
console.log('Lock integrity validator passed. All declared packages are locked and script tool references are installed locally.');
