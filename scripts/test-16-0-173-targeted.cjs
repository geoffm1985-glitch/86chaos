#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const commands = [
  ['node', '--test', 'api/staff-email-change-16-0-173.test.cjs', 'api/staff-email-edit-source-16-0-173.test.cjs', 'api/employee-access-revocation.test.cjs', 'api/employee-access-firestore-icon-16-0-161.test.cjs'],
  ['node', 'scripts/validate-16-0-173.js']
];
let failed = 0;
for (const cmd of commands) {
  console.log(`[16.0.173 targeted] ${cmd.join(' ')}`);
  const result = spawnSync(cmd[0], cmd.slice(1), { cwd: root, stdio: 'inherit', shell: false, env: process.env });
  if ((result.status || 0) !== 0) failed += 1;
}
process.exit(failed ? 1 : 0);
