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

test('release-gate runners use observable setup, overlap protection, and isolated rules ports', () => {
  const ps1 = fs.readFileSync(path.join(root, 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'), 'utf8');
  const nodeChecks = fs.readFileSync(path.join(root, 'scripts', '86chaos-release-gate', 'run-node-release-checks.cjs'), 'utf8');
  assert.match(ps1, /Verify npm wrapper/);
  assert.match(ps1, /run-observable-command\.cjs/);
  assert.match(ps1, /--timeout 1800/);
  assert.match(ps1, /\.current-run\.lock/);
  assert.match(ps1, /BLOCKED BEFORE TEST EXECUTION/);
  assert.match(ps1, /UTF8Encoding/);
  assert.match(nodeChecks, /reserveAvailableLoopbackPorts\(2\)/);
  assert.match(nodeChecks, /port: 0, exclusive: true/);
  assert.match(nodeChecks, /require\.resolve\('firebase-tools\/package\.json'/);
  assert.match(nodeChecks, /quoteShellArgument\(firebaseCli\)/);
  assert.match(nodeChecks, /--config \$\{quoteShellArgument\(temp\.configPath\)\}/);
  assert.match(nodeChecks, /--project demo-no-project/);
  assert.match(nodeChecks, /Firebase emulator startup port collision; retrying/);
  assert.doesNotMatch(nodeChecks, /(?:taskkill|Stop-Process|kill\s+-9)/i);
});

test('observable dependency wrapper avoids shell true and direct npm.cmd process spawning', () => {
  const source = fs.readFileSync(runner, 'utf8');
  assert.match(source, /resolveNpmCli/);
  assert.match(source, /process\.execPath/);
  assert.doesNotMatch(source, /spawn\(command, args, \{[\s\S]{0,260}shell:\s*true/);
  assert.match(source, /PROCESS_ERROR_META/);
});

test('PowerShell runner collects status, exports, persists whole-run timing, and rebuilds slim evidence', () => {
  const ps1 = fs.readFileSync(path.join(root, 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'), 'utf8');
  const statusIndex = ps1.indexOf("$RunnerState.status = 'blocked'");
  const collectIndex = ps1.indexOf('Run-CollectorStep "Collect report"', statusIndex);
  const firstZipIndex = ps1.indexOf('New-Slim-ReleaseGateReport', collectIndex);
  const finalIndex = ps1.indexOf('$RunnerState.finishedAt =', firstZipIndex);
  const timingIndex = ps1.indexOf('Update-TotalTimingEvidence', finalIndex);
  const finalZipIndex = ps1.indexOf('New-Slim-ReleaseGateReport', timingIndex);
  assert.ok(statusIndex >= 0, 'final result status block exists');
  assert.ok(collectIndex > statusIndex, 'collector sees the result status');
  assert.ok(firstZipIndex > collectIndex, 'initial slim export follows report collection');
  assert.ok(finalIndex > firstZipIndex, 'whole-run timing closes after the initial export');
  assert.ok(timingIndex > finalIndex, 'timing evidence is persisted after the clock closes');
  assert.ok(finalZipIndex > timingIndex, 'slim artifact is rebuilt with timing evidence');
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
