'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
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

test('observable command can run npm --version through the same wrapper used before npm ci', () => {
  const result = spawnSync(process.execPath, [runner, '--label', 'npm version smoke', '--heartbeat', '5', '--timeout', '60', '--', 'npm', '--version'], { cwd: root, encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /NPM_VERSION|npm version smoke/);
  assert.match(result.stdout, /FINISHED npm version smoke/);
});

test('Windows .cmd wrapper handles a path with spaces without EINVAL', { skip: process.platform !== 'win32' }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '86 chaos cmd test '));
  const cmd = path.join(tmp, 'hello spaced.cmd');
  fs.writeFileSync(cmd, '@echo off\r\necho spaced path ok\r\n', 'utf8');
  const result = spawnSync(process.execPath, [runner, '--label', 'path with spaces cmd', '--heartbeat', '5', '--timeout', '60', '--', cmd], { cwd: root, encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /spaced path ok/);
});

test('PowerShell runner uses observable dependency install, npm smoke, UTF-8, and overlap lock', () => {
  const ps1 = fs.readFileSync(path.join(root, 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'), 'utf8');
  assert.match(ps1, /Verify npm wrapper/);
  assert.match(ps1, /run-observable-command\.cjs/);
  assert.match(ps1, /--timeout 1800/);
  assert.match(ps1, /\.current-run\.lock/);
  assert.match(ps1, /BLOCKED BEFORE TEST EXECUTION/);
  assert.match(ps1, /UTF8Encoding/);
});

test('observable dependency wrapper avoids shell true and direct npm.cmd process spawning', () => {
  const source = fs.readFileSync(runner, 'utf8');
  assert.match(source, /resolveNpmCli/);
  assert.match(source, /process\.execPath/);
  assert.doesNotMatch(source, /spawn\(command, args, \{[\s\S]{0,260}shell:\s*true/);
  assert.match(source, /PROCESS_ERROR_META/);
});

test('PowerShell runner saves final state before creating slim upload zip', () => {
  const ps1 = fs.readFileSync(path.join(root, 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'), 'utf8');
  const finalIndex = ps1.indexOf('$RunnerState.finishedAt =');
  const saveIndex = ps1.indexOf('Save-RunnerState', finalIndex);
  const collectIndex = ps1.indexOf('Run-CollectorStep "Collect report"', finalIndex);
  const zipIndex = ps1.indexOf('New-Slim-ReleaseGateReport', finalIndex);
  assert.ok(finalIndex >= 0, 'final status block exists');
  assert.ok(saveIndex > finalIndex, 'final status is saved');
  assert.ok(collectIndex > saveIndex, 'report collection sees finalized state');
  assert.ok(zipIndex > collectIndex, 'slim zip is created after final state and collector');
  assert.match(ps1, /\$RunnerState\.finalExitCode = 1/);
});

test('release-gate JSON helper parses BOM-prefixed runner state and preserves diagnostics on invalid JSON', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { readJsonIfExists } = require('../scripts/86chaos-release-gate/json-utils.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '86-chaos-json-bom-'));
  const statePath = path.join(dir, 'runner-state.json');
  fs.writeFileSync(statePath, '\uFEFF{"status":"blocked","blockingReason":"account provisioning blocked","finalExitCode":1}\r\n', 'utf8');
  const parsed = readJsonIfExists(statePath);
  assert.equal(parsed.status, 'blocked');
  assert.equal(parsed.blockingReason, 'account provisioning blocked');
  const diagnostics = [];
  fs.writeFileSync(path.join(dir, 'bad.json'), '\uFEFF{"status":', 'utf8');
  assert.equal(readJsonIfExists(path.join(dir, 'bad.json'), diagnostics), null);
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0].error, /Unexpected|JSON/);
});
