#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const reactScripts = path.join(root, 'node_modules', '.bin', isWin ? 'react-scripts.cmd' : 'react-scripts');

const nodeTests = [
  'api/month-print-source.test.cjs',
  'api/staff-member-email-update-source.test.cjs',
  'api/posthog-instrumentation-source.test.cjs',
  'api/pwa-icon-source-integrity.test.cjs',
  'api/icon-manifest-header-branding.test.cjs',
  'api/schedule-identity-dedupe-16-0-173.test.cjs',
  'api/staff-member-identity-contamination-16-0-175.test.cjs',
  'api/partial-resume-release-gate-source-16-0-177.test.cjs',
  'api/login-workspace-resume-16-0-177.test.cjs',
  'api/current-blockers-release-gate-source-16-0-180.test.cjs'
];
const jestTests = [
  'src/core/scheduleQueryPlanner.test.js'
];

function run(label, command, args, opts = {}) {
  console.log(`\n===== ${label} =====`);
  console.log([command, ...args].join(' '));
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, CI: 'true', FORCE_COLOR: process.env.FORCE_COLOR || '1' },
    ...opts
  });
  if (result.error) {
    console.error(`\n${label} could not start: ${result.error.message}`);
    return 1;
  }
  return result.status || 0;
}

const missingNodeTests = nodeTests.filter(file => !fs.existsSync(path.join(root, file)));
if (missingNodeTests.length) {
  console.error('Missing targeted Node tests:');
  missingNodeTests.forEach(file => console.error(`- ${file}`));
  process.exit(1);
}

let status = run('Targeted Node/API/source regressions since 16.0.170', process.execPath, ['--test', ...nodeTests]);
if (status !== 0) process.exit(status);

if (process.argv.includes('--node-only')) {
  console.log('\nNode-only targeted regressions passed. Skipped Jest because --node-only was supplied.');
  process.exit(0);
}

if (!fs.existsSync(reactScripts)) {
  console.error('\nBLOCKED: react-scripts is not installed, so the targeted client/Jest test cannot run.');
  console.error('Run npm ci --no-audit --no-fund from the app folder, then run npm run test:since-16-0-170 again.');
  process.exit(1);
}

status = run('Targeted client/Jest regressions since 16.0.170', reactScripts, ['test', '--watchAll=false', '--runInBand', ...jestTests]);
if (status !== 0) process.exit(status);

console.log('\nTargeted 16.0.170 -> current regression checks passed.');
