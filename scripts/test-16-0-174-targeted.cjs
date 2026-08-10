#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const commands = [
  ['node', '--test', 'api/month-view-print-16-0-172.test.cjs', 'api/print-calendar-layout.test.cjs'],
  ['node', 'scripts/validate-16-0-174.js']
];
let failed = 0;
for (const cmd of commands) {
  console.log(`[16.0.174 targeted] ${cmd.join(' ')}`);
  const result = spawnSync(cmd[0], cmd.slice(1), { cwd: root, stdio: 'inherit', shell: false, env: process.env });
  if ((result.status || 0) !== 0) failed += 1;
}
process.exit(failed ? 1 : 0);
