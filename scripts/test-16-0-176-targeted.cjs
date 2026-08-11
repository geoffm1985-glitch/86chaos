#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const commands = [
  ['node', '--test', 'api/full-suite-windows-runner-16-0-176.test.cjs'],
  ['node', '--test', 'api/dependency-security-16-0-176.test.cjs', 'api/lint-config-16-0-176.test.cjs', 'api/cost-provenance-16-0-176.test.cjs', 'api/presence-workspace-summary-16-0-176.test.cjs', 'api/system-admin-nuke-users-16-0-176.test.cjs'],
  ['node', '--test', 'api/month-view-print-16-0-172.test.cjs', 'api/print-calendar-layout.test.cjs'],
  ['node', 'scripts/validate-16-0-176.js']
];
let failed = 0;
for (const cmd of commands) {
  console.log(`[16.0.176 targeted] ${cmd.join(' ')}`);
  const result = spawnSync(cmd[0], cmd.slice(1), { cwd: root, stdio: 'inherit', shell: false, env: process.env });
  if ((result.status || 0) !== 0) failed += 1;
}
process.exit(failed ? 1 : 0);
