#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const groups = [
  ['node', '--test', 'api/firebase-efficiency-completion-16-0-187.test.cjs'],
  ['node', '--test', 'api/release-gate-dependency-preflight-16-0-185.test.cjs', 'api/firebase-efficiency-presence-16-0-186.test.cjs'],
  ['node', 'scripts/validate-16-0-187.js']
];
let failed = 0;
for (const cmd of groups) {
  console.log(`[16.0.187 targeted] ${cmd.join(' ')}`);
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: false });
  if ((result.status ?? 1) !== 0) { failed += 1; break; }
}
process.exit(failed === 0 ? 0 : 1);
