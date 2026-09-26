'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const runner = fs.readFileSync(path.join(root, 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'), 'utf8');

test('full gate initializes safe auto-provision role credentials before environment preflight', () => {
  const autoFlag = runner.indexOf('CHAOS_QA_AUTO_PROVISION_TEST_USERS = "true"');
  const initCall = runner.indexOf('Initialize-AutoProvisionRoleAccounts', autoFlag);
  const preflight = runner.indexOf('Run-Step "Environment preflight"');
  assert.ok(autoFlag >= 0, 'auto-provision enablement exists');
  assert.ok(initCall > autoFlag, 'role bootstrap follows auto-provision enablement');
  assert.ok(preflight > initCall, 'role bootstrap executes before environment preflight');
});

test('role bootstrap is cryptographically generated, testing-only, branch-isolated, and fail-closed for partial pairs', () => {
  assert.match(runner, /RandomNumberGenerator\]::Create\(\)/);
  assert.match(runner, /20260925-0619/);
  assert.match(runner, /20260925-0620/);
  for (const slug of ['system-admin','owner','manager','staff']) {
    assert.match(runner, new RegExp(`86chaos\\.qa\\.\\$\\(\\$role\\.Slug\\)\\.\\$stamp@example\\.test`));
    assert.match(runner, new RegExp(`Slug = '${slug}'`));
  }
  assert.match(runner, /\$emailPresent -ne \$passwordPresent/);
  assert.match(runner, /Auto-provision refuses a partial QA role credential pair/);
  assert.match(runner, /SetEnvironmentVariable\(\$role\.Password, \(New-ReleaseGateQaPassword\), 'Process'\)/);
});

test('generated QA passwords are not written to release-gate console output', () => {
  const helperStart = runner.indexOf('function New-ReleaseGateQaPassword');
  const helperEnd = runner.indexOf('function Import-EnvFile', helperStart);
  const helperAndBootstrap = runner.slice(helperStart, helperEnd);
  assert.doesNotMatch(helperAndBootstrap, /Write-Host[^\r\n]*(password|Password|\$password|generatedEmail)/);
  assert.doesNotMatch(helperAndBootstrap, /Write-Output[^\r\n]*(password|Password|\$password)/);
});
