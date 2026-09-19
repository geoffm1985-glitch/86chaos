#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '..');
const scripts = [
  'validate-auth-hotfix.js',
  'validate-repair.js',
  'validate-rules.js',
  'validate-performance-split.js',
  'validate-python-ops-restore.js',
  'validate-python-auth-fallback.js',
  'validate-python-ops-fallback-fix.js'
];
let failed = false;
for (const script of scripts) {
  console.log(`\n== ${script} ==`);
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
