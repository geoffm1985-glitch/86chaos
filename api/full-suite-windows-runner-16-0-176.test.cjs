'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const runnerPath = path.join(root, 'RUN_86CHAOS_FULL_TEST_SUITE.ps1');
const source = fs.readFileSync(runnerPath, 'utf8');
function withoutComments(text) { return text.replace(/<#([\s\S]*?)#>/g, '').replace(/#.*/g, ''); }
const code = withoutComments(source);
test('16.0.175 native stderr and finalization protections remain intact', () => {
  assert.match(code, /function\s+Invoke-LoggedNativeCommand/);
  assert.match(code, /\$cmdLine\s*=\s*\$Command\s*\+\s*' 2>&1'/);
  assert.match(code, /\$status\s*=\s*if\s*\(\$exitCode\s+-eq\s+0\)/);
  assert.match(code, /function\s+Get-SafeNativeFirstLine/);
  assert.doesNotMatch(code, /&\s*java\s+-version\s+2>&1/);
  assert.match(code, /try\s*{\s*Write-Reports\s*}\s*catch\s*{[\s\S]*?Write-EmergencyReports[\s\S]*?}\s*try\s*{\s*\$zip\s*=\s*Create-UploadZip/s);
  assert.match(code, /REPORT GENERATION ERROR/);
});
test('full suite imports .env.test.local for mutating QA without blindly importing .env.local', () => {
  assert.match(code, /function\s+Read-EnvFileMap/);
  assert.match(code, /Initialize-FullSuiteQaEnvironment/);
  assert.match(code, /\.env\.test\.local/);
  assert.match(code, /Import-TestEnvFileForMutatingSuite/);
  assert.doesNotMatch(code, /Read-EnvFileMap[\s\S]*\.env\.local[\s\S]*Import-TestEnvFileForMutatingSuite/);
});
test('QA project resolution accepts only chaos-test-d1601 and rejects production, missing, and conflicts', () => {
  assert.match(code, /CHAOS_TEST_FIREBASE_PROJECT_ID/);
  assert.match(code, /CHAOS_QA_FIREBASE_PROJECT_ID/);
  assert.match(code, /REACT_APP_FIREBASE_PROJECT_ID/);
  assert.match(code, /cheers-34b8d/);
  assert.match(code, /__conflict__/);
  assert.match(code, /Firebase project identity is missing/);
  assert.match(code, /SafeProjectBlockReason/);
});
test('five dry runs are explicitly scoped to chaos-test-d1601', () => {
  for (const command of [
    'node scripts/setup-native-firestore-backup.js --dry-run --project=chaos-test-d1601',
    'node scripts/migrate-workspace-memberships.js --project=chaos-test-d1601',
    'node scripts/migrate-reminder-dispatch-queue.js --dry-run --project=chaos-test-d1601',
    'node scripts/migrate-schedule-query-fields.js --dry-run --project=chaos-test-d1601',
    'node scripts/migrate-reminder-participants.js --dry-run --project=chaos-test-d1601'
  ]) assert.match(code, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
test('cost validation is planned after the full browser producer and does not require FIRESTORE_EMULATOR_HOST', () => {
  const browser = code.indexOf("Add-PlannedStep 'Full Browser Release Gate'");
  const cost = code.indexOf("Add-PlannedStep 'Cost / Firestore Regression'");
  assert.ok(browser >= 0 && cost > browser);
  assert.match(code, /Prepare-CostReportValidationEnv/);
  assert.match(code, /\.last-run\.json/);
  assert.match(code, /CHAOS_COST_EXPECTED_RUN_ID/);
  assert.doesNotMatch(code, /FIRESTORE_EMULATOR_HOST is not configured/);
});
