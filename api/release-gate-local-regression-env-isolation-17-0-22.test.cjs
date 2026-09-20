'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runner = path.join(root, 'scripts', '86chaos-release-gate', 'run-hermetic-repair-tests.cjs');
const updater = path.join(root, 'RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1');
const pkg = require(path.join(root, 'package.json'));

const pollutedKeys = [
  'APP_URL', 'CHAOS_BASE_URL', 'CHAOS_EXPECTED_VERSION', 'CHAOS_EXPECTED_GIT_COMMIT',
  'CHAOS_CERTIFICATION_MODE', 'CHAOS_RELEASE_GATE_SELECTION_MODE',
  'CHAOS_RELEASE_GATE_RUN_ID', 'CHAOS_FULL_AUDIT_RUN_ID', 'CHAOS_RELEASE_GATE_RUN_DIR',
  'CHAOS_RELEASE_GATE_STEP_FAILURES', 'CHAOS_RELEASE_GATE_TEST_MODE', 'CHAOS_ALLOW_MUTATION',
  'CHAOS_STRICT_VERCEL_BUILD_WORKSPACE', 'CHAOS_QA_AUTO_PROVISION_TEST_USERS',
  'VERCEL', 'VERCEL_ENV', 'VERCEL_GIT_COMMIT_SHA', 'VERCEL_GIT_COMMIT_REF', 'VERCEL_PROJECT_ID', 'VERCEL_URL',
  'SYSTEM_ADMIN_EMAIL', 'OWNER_EMAIL', 'MANAGER_EMAIL', 'STAFF_EMAIL', 'MASTER_ADMIN_EMAIL',
  'REACT_APP_FIREBASE_PROJECT_ID', 'REACT_APP_TEST_FIREBASE_PROJECT_ID',
  'FIREBASE_TEST_SERVICE_ACCOUNT_KEY', 'FIREBASE_SERVICE_ACCOUNT_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'NODE_OPTIONS',
];

test('17.0.22 hermetic repair runner strips polluted release workflow state but preserves normal OS environment', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-1722-env-'));
  try {
    const fixture = path.join(dir, 'env-clean.test.cjs');
    fs.writeFileSync(fixture, `
      const test = require('node:test');
      const assert = require('node:assert/strict');
      const keys = ${JSON.stringify(pollutedKeys)};
      test('sanitized environment', () => {
        for (const key of keys) assert.equal(process.env[key], undefined, key + ' must not leak');
        assert.ok(process.env.PATH || process.env.Path, 'normal OS PATH must remain available');
      });
    `);
    const env = { ...process.env };
    for (const key of pollutedKeys) env[key] = key.includes('URL') || key === 'APP_URL' || key === 'CHAOS_BASE_URL' ? 'https://polluted.example.test' : 'polluted';
    env.CHAOS_RELEASE_GATE_STEP_FAILURES = '9';
    env.CHAOS_STRICT_VERCEL_BUILD_WORKSPACE = '1';
    env.VERCEL = '1';
    const result = cp.spawnSync(process.execPath, [runner, fixture], { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 30000 });
    assert.equal(result.status, 0, `hermetic child must pass\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
    // Child exit status is authoritative; reporter text varies across supported Node releases.
    assert.match(result.stdout, /sanitized environment/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('17.0.22 updater clears stale run-state and Vercel diagnostic variables before current release regressions', () => {
  const source = fs.readFileSync(updater, 'utf8');
  const isolate = source.indexOf("Invoke-Stage 'isolate local release validation environment'");
  const repair = source.indexOf("Invoke-Stage 'current release regression tests'");
  assert.ok(isolate > 0 && repair > isolate);
  for (const key of [
    'CHAOS_RELEASE_GATE_RUN_ID', 'CHAOS_FULL_AUDIT_RUN_ID', 'CHAOS_RELEASE_GATE_RUN_DIR',
    'CHAOS_RELEASE_GATE_STEP_FAILURES', 'CHAOS_STRICT_VERCEL_BUILD_WORKSPACE',
    'VERCEL', 'VERCEL_ENV', 'VERCEL_GIT_COMMIT_SHA', 'VERCEL_GIT_COMMIT_REF', 'VERCEL_PROJECT_ID', 'VERCEL_URL',
  ]) assert.match(source, new RegExp(`'${key}'`), `${key} must be cleared before local regressions`);
});

test('17.0.22 package repair command routes the full regression universe through the hermetic runner', () => {
  const command = pkg.scripts['test:repair:17.0.22'];
  assert.match(command, /run-hermetic-repair-tests\.cjs/);
  assert.match(command, /release-gate-local-regression-env-isolation-17-0-22\.test\.cjs/);
  assert.match(command, /release-gate-harness-env-isolation-17-0-21\.test\.cjs/);
  assert.match(command, /failure-extractor-bounded-17-0-20\.test\.cjs/);
  assert.match(command, /release-gate-certification-integrity-17-0-19\.test\.cjs/);
  assert.match(command, /test-harness-lifecycle\.test\.cjs/);
});
