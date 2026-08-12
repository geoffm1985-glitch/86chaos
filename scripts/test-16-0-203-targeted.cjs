#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const commands = [
  ['node', 'scripts/validate-16-0-203.js'],
  ['node', '--test', 'api/firebase-efficiency-baseline-16-0-203.test.cjs'],
  ['node', '--test', 'api/schedule-published-display-cleanup-16-0-203.test.cjs']
];
for (const cmd of commands) {
  console.log(`[16.0.203] ${cmd.join(' ')}`);
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: false });
  if ((result.status || 0) !== 0) process.exit(result.status || 1);
}
console.log('16.0.203 targeted Firebase efficiency and Schedule display cleanup checks passed.');
