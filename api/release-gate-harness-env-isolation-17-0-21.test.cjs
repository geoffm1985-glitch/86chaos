'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const harness = path.join(root, 'tests', '86chaos-release-gate', 'test-harness-lifecycle.test.cjs');

test('17.0.21 synthetic collector fixture ignores ambient release identity from the real updater', () => {
  const env = {
    ...process.env,
    APP_URL: 'https://immutable.example.test',
    CHAOS_BASE_URL: 'https://immutable.example.test',
    CHAOS_EXPECTED_VERSION: '17.0.21',
    CHAOS_EXPECTED_GIT_COMMIT: 'a'.repeat(40),
    CHAOS_EXPECTED_BRANCH: 'testing',
    CHAOS_SOURCE_MANIFEST_HASH: 'b'.repeat(64),
    CHAOS_SOURCE_ARCHIVE_SHA256: 'c'.repeat(64),
    CHAOS_EXPECTED_VERCEL_PROJECT_SLUG: '86chaos',
    CHAOS_EXPECTED_VERCEL_PROJECT_ID: 'prj_test',
    CHAOS_CERTIFICATION_MODE: 'true',
    CHAOS_RELEASE_GATE_SELECTION_MODE: 'full',
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
    VERCEL_GIT_COMMIT_REF: 'testing',
    VERCEL_PROJECT_ID: 'prj_test',
    VERCEL_URL: 'immutable.example.test',
  };

  delete env.NODE_TEST_CONTEXT;
  const result = cp.spawnSync(
    process.execPath,
    [
      '--test',
      '--test-name-pattern=collector keeps node summary expected-skipped when provisioning blocks before tests',
      harness,
    ],
    {
      cwd: root,
      env,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
    }
  );

  assert.equal(
    result.status,
    0,
    `polluted ambient release identity must not alter the synthetic collector fixture\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
  );
  // Child exit status is authoritative; reporter text varies across supported Node releases.
  assert.match(result.stdout, /collector keeps node summary expected-skipped when provisioning blocks before tests/);
});

test('17.0.21 synthetic collector helper restores the ambient release environment after collection', () => {
  const source = fs.readFileSync(harness, 'utf8');
  assert.match(source, /withIsolatedSyntheticCollectorEnv/);
  assert.match(source, /process\.exitCode = oldExitCode/);
  assert.match(source, /else process\.env\[key\] = value/);
  assert.match(source, /CHAOS_EXPECTED_VERSION/);
  assert.match(source, /CHAOS_CERTIFICATION_MODE/);
});


test('17.0.21 updater clears stale deployed-gate identity before local repair tests and reconfigures it only after deployment', () => {
  const updater = fs.readFileSync(path.join(root, 'RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1'), 'utf8');
  const isolate = updater.indexOf("Invoke-Stage 'isolate local release validation environment'");
  const repair = updater.indexOf("Invoke-Stage 'current release regression tests'");
  const configure = updater.indexOf("Invoke-Stage 'configure full release gate'");
  assert.ok(isolate > 0 && repair > isolate && configure > repair);
  assert.match(updater, /SetEnvironmentVariable\(\$key, \$null, 'Process'\)/);
  assert.match(updater, /'CHAOS_EXPECTED_VERSION'/);
  assert.match(updater, /'CHAOS_CERTIFICATION_MODE'/);
  assert.match(updater, /'CHAOS_FIREBASE_AUTH_REFERRER_URL'/);
  assert.match(updater, /\$env:CHAOS_EXPECTED_VERSION = \$ExpectedVersion/);
  assert.match(updater, /\$env:CHAOS_FIREBASE_AUTH_REFERRER_URL = \$StableTestingAlias/);
});
