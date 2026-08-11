'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runnerPath = path.join(root, 'RUN_86CHAOS_FULL_TEST_SUITE.ps1');
const source = fs.readFileSync(runnerPath, 'utf8');

function withoutComments(text) {
  return text.replace(/<#([\s\S]*?)#>/g, '').replace(/#.*/g, '');
}

const code = withoutComments(source);

test('Native stderr is merged child-side and not through PowerShell ErrorRecord redirection', () => {
  assert.match(code, /function\s+Invoke-LoggedNativeCommand/);
  assert.match(code, /\$cmdLine\s*=\s*\$Command\s*\+\s*' 2>&1'/);
  assert.match(code, /&\s*\$env:ComSpec\s+\/d\s+\/s\s+\/c\s+\$cmdLine\s*\|\s*Tee-Object/);
  assert.doesNotMatch(code, /&\s*cmd\.exe\s+\/d\s+\/s\s+\/c\s+\$Command\s+2>&1\s*\|\s*Tee-Object/);
});

test('Run-Step status is based on the real native process exit code only', () => {
  assert.match(code, /\$exitCode\s*=\s*\[int\]\$nativeResult\.exitCode/);
  assert.match(code, /\$status\s*=\s*if\s*\(\$exitCode\s+-eq\s+0\)\s*{\s*'pass'\s*}\s*else\s*{\s*'fail'\s*}/);
  assert.doesNotMatch(code, /stderr\s*-ne\s*''/i);
  assert.doesNotMatch(code, /log\s+contains/i);
  assert.doesNotMatch(code, /contains\(['"]warn/i);
});

test('Java finalizer uses safe native version capture', () => {
  assert.match(code, /function\s+Get-SafeNativeFirstLine/);
  assert.match(code, /'Java version: '\s*\+\s*\(Get-SafeNativeFirstLine\s+'java -version'/);
  assert.doesNotMatch(code, /&\s*java\s+-version\s+2>&1/);
});

test('Report finalizer does not use npx metadata downloads', () => {
  assert.doesNotMatch(code, /npx\s+firebase\s+--version/);
  assert.doesNotMatch(code, /npx\s+playwright\s+--version/);
  assert.match(code, /Get-LocalPackageVersion\s+'node_modules\/firebase-tools\/package\.json'/);
  assert.match(code, /Get-LocalPackageVersion\s+'node_modules\/@playwright\/test\/package\.json'/);
});

test('Upload ZIP creation is independent from normal report generation success', () => {
  assert.match(code, /try\s*{\s*Write-Reports\s*}\s*catch\s*{[\s\S]*?Write-EmergencyReports[\s\S]*?}\s*try\s*{\s*\$zip\s*=\s*Create-UploadZip/s);
  assert.match(code, /function\s+Write-EmergencyReports/);
  assert.match(code, /REPORT GENERATION ERROR/);
});

test('Emergency report path guarantees minimum summary files before ZIP attempt', () => {
  const emergency = code.slice(code.indexOf('function Write-EmergencyReports'), code.indexOf('function Update-ResultZipMetadata'));
  for (const required of ['TEST-SUMMARY.txt', 'FAILED-TESTS.txt', 'BLOCKED-TESTS.txt', 'ENVIRONMENT.txt']) {
    assert.match(emergency, new RegExp(required.replace('.', '\\.')));
  }
});

test('Safe Migration / Backup Dry Runs are blocked unless QA project is exact', () => {
  assert.match(code, /function\s+Resolve-TargetFirebaseProjectId/);
  assert.match(code, /function\s+SafeProjectBlockReason/);
  assert.match(code, /\$targetProject\s+-eq\s+\$Expected/);
  assert.match(code, /\$targetProject\s+-eq\s+'cheers-34b8d'/);
  assert.match(code, /__conflict__/);
  assert.match(code, /Firebase project identity is missing or unknown/);
  assert.match(code, /Safe Firebase dry-run target is not exactly chaos-test-d1601\./);
  const dryRunLoop = code.slice(code.indexOf("$p.group -eq 'Safe Migration / Backup Dry Runs'"), code.indexOf("$p.group -eq 'Full Browser Release Gate'"));
  assert.match(dryRunLoop, /SafeProjectBlockReason\s+'chaos-test-d1601'/);
  assert.match(dryRunLoop, /Add-BlockedStep/);
});

test('Production project cannot execute safe dry-run or full browser operations', () => {
  assert.match(code, /CHAOS_FIREBASE_PROJECT_ID/);
  assert.match(code, /REACT_APP_FIREBASE_PROJECT_ID/);
  assert.match(code, /CHAOS_TARGET_FIREBASE_PROJECT_ID/);
  assert.match(code, /cheers-34b8d/);
  assert.match(code, /Safe Firebase dry-run target is not exactly chaos-test-d1601\./);
  const browserLoop = code.slice(code.indexOf("$p.group -eq 'Full Browser Release Gate'"), code.indexOf("$p.group -eq 'Cost / Firestore Regression'"));
  assert.match(browserLoop, /SafeProjectBlockReason\s+'chaos-test-d1601'/);
  assert.match(browserLoop, /Add-BlockedStep/);
});
