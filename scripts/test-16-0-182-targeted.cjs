#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const groups = [
  ['node', '--test', 'api/release-integrity-account-lifecycle-16-0-177.test.cjs'],
  ['node', '--test', 'api/full-suite-windows-runner-16-0-175.test.cjs', 'api/full-suite-windows-runner-16-0-176.test.cjs'],
  ['node', '--test', 'api/dependency-security-16-0-176.test.cjs', 'api/vite-jsx-module-type-16-0-182.test.cjs', 'api/vite-lock-integrity-16-0-180.test.cjs', 'api/vercel-vite-native-binding-16-0-181.test.cjs', 'api/lint-config-16-0-176.test.cjs', 'api/lint-esm-api-16-0-179.test.cjs', 'api/cost-provenance-16-0-176.test.cjs', 'api/presence-workspace-summary-16-0-176.test.cjs', 'api/system-admin-nuke-users-16-0-176.test.cjs'],
  ['node', 'scripts/validate-16-0-182.js']
];
let failed = 0;
for (const cmd of groups) {
  console.log(`[16.0.182 targeted] ${cmd.join(' ')}`);
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: false });
  if ((result.status ?? 1) !== 0) { failed += 1; break; }
}
process.exit(failed === 0 ? 0 : 1);
