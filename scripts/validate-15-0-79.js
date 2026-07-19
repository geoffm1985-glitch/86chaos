#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '..');
const scripts = ['validate-auth-hotfix.js', 'validate-repair.js', 'validate-rules.js', 'validate-performance-split.js'];
let failed = false;
for (const script of scripts) {
  console.log(`
== ${script} ==`);
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
