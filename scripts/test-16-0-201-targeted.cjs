#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const commands = [
  ['node', 'scripts/validate-16-0-201.js'],
  ['node', '--test', 'api/schedule-query-planner-client-test-16-0-201.test.cjs'],
  ['node', '--test', 'api/schedule-subtab-navigation-16-0-201.test.cjs'],
  ['node', '--test', 'api/page-load-readiness-16-0-201.test.cjs'],
  ['node', '--test', 'api/last-known-good-route-load-16-0-201.test.cjs'],
  ['node', '--test', 'api/shared-listener-release-runtime-16-0-201.test.cjs'],
  ['node', '--test', 'api/authenticated-section-load-runtime-16-0-193.test.cjs'],
  ['node', '--test', 'api/firebase-efficiency-finalization-16-0-192.test.cjs'],
  ['node', '--test', 'api/firebase-efficiency-finalization-16-0-190.test.cjs'],
  ['node', '--test', 'api/firebase-efficiency-finalization-16-0-189.test.cjs'],
  ['node', '--test', 'api/firebase-efficiency-finalization-16-0-188.test.cjs'],
  ['node', '--test', 'api/firebase-efficiency-presence-16-0-186.test.cjs'],
  ['node', '--test', 'api/firebase-efficiency-completion-16-0-187.test.cjs'],
  ['node', '--test', 'api/release-gate-dependency-preflight-16-0-185.test.cjs'],
  ['node', '--test', 'api/app-only-package-hygiene-16-0-201.test.cjs']
];
for (const cmd of commands) {
  console.log(`[16.0.201 targeted] ${cmd.join(' ')}`);
  const childEnv = { ...process.env };
  if (cmd.includes('api/app-only-package-hygiene-16-0-201.test.cjs')) {
    childEnv.CHAOS_ALLOW_GENERATED_TEST_ARTIFACTS = '1';
    childEnv.CHAOS_ALLOW_LOCAL_RELEASE_ARTIFACTS = '1';
  }
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: process.platform === 'win32', env: childEnv });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('16.0.201 targeted repair checks passed.');
