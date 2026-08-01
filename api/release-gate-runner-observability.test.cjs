'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const runner = path.join(root, 'scripts', '86chaos-release-gate', 'run-observable-command.cjs');

test('observable command records successful dependency-step completion', () => {
  const result = spawnSync(process.execPath, [runner, '--label', 'tiny success', '--heartbeat', '5', '--timeout', '60', '--', process.execPath, '-e', "console.log('install ok')"], { cwd: root, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /START tiny success/);
  assert.match(result.stdout, /FINISHED tiny success/);
  assert.match(result.stdout, /exitCode=0/);
});

test('observable command times out and exits with 124', () => {
  const result = spawnSync(process.execPath, [runner, '--label', 'tiny timeout', '--heartbeat', '5', '--timeout', '1', '--', process.execPath, '-e', 'setTimeout(() => {}, 5000)'], { cwd: root, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 124, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /TIMED OUT tiny timeout/);
  assert.match(`${result.stdout}\n${result.stderr}`, /timedOut=true/);
});

test('PowerShell runner uses observable dependency install and overlap lock', () => {
  const ps1 = require('fs').readFileSync(path.join(root, 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'), 'utf8');
  assert.match(ps1, /run-observable-command\.cjs/);
  assert.match(ps1, /--timeout 1800/);
  assert.match(ps1, /\.current-run\.lock/);
  assert.match(ps1, /BLOCKED BEFORE TEST EXECUTION/);
});
