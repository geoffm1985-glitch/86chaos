#!/usr/bin/env node
'use strict';

const cp = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const testFiles = process.argv.slice(2);
if (!testFiles.length) {
  console.error('No repair regression test files were supplied.');
  process.exit(2);
}

// Local release regression tests must model only the state they explicitly set.
// A prior failed full gate can leave these variables in the parent PowerShell
// process, and inheriting them makes unit fixtures nondeterministic.
const AMBIENT_RELEASE_TEST_KEYS = Object.freeze([
  'APP_URL', 'BASE_URL', 'PLAYWRIGHT_BASE_URL', 'CHAOS_BASE_URL',
  'CHAOS_EXPECTED_VERSION', 'CHAOS_EXPECTED_GIT_COMMIT', 'CHAOS_EXPECTED_BRANCH',
  'CHAOS_SOURCE_MANIFEST_HASH', 'CHAOS_SOURCE_ARCHIVE_SHA256',
  'CHAOS_EXPECTED_VERCEL_PROJECT_SLUG', 'CHAOS_EXPECTED_VERCEL_PROJECT_ID',
  'CHAOS_EXPECTED_TEST_FIREBASE_PROJECT_ID', 'CHAOS_FIREBASE_TEST_PROJECT',
  'CHAOS_FIREBASE_AUTH_REFERRER_URL', 'CHAOS_CERTIFICATION_MODE',
  'CHAOS_RELEASE_GATE_SELECTION_MODE', 'CHAOS_FAILED_ONLY_RELEASE_GATE',
  'CHAOS_FAILED_AND_NEW_RELEASE_GATE', 'CHAOS_AUTOMATED_RELEASE_WORKFLOW',
  'CHAOS_IMMUTABLE_VERCEL_URL', 'CHAOS_IMMUTABLE_VERCEL_DEPLOYMENT_ID',
  'CHAOS_RELEASE_GATE_RUN_ID', 'CHAOS_FULL_AUDIT_RUN_ID', 'CHAOS_RELEASE_GATE_RUN_DIR',
  'CHAOS_RELEASE_GATE_STEP_FAILURES', 'CHAOS_PARTIAL_RESUME_RUN_DIR',
  'CHAOS_RELEASE_GATE_TEST_MODE', 'CHAOS_ALLOW_MUTATION',
  'CHAOS_QA_AUTO_PROVISION_TEST_USERS', 'CHAOS_QA_ALLOW_MUTATING_ROLE_ACCOUNTS',
  'CHAOS_STRICT_VERCEL_BUILD_WORKSPACE',
  'VERCEL', 'VERCEL_ENV', 'VERCEL_GIT_COMMIT_SHA', 'VERCEL_GIT_COMMIT_REF',
  'VERCEL_PROJECT_ID', 'VERCEL_URL',
  'SYSTEM_ADMIN_EMAIL', 'SYSTEM_ADMIN_PASSWORD', 'OWNER_EMAIL', 'OWNER_PASSWORD',
  'MANAGER_EMAIL', 'MANAGER_PASSWORD', 'STAFF_EMAIL', 'STAFF_PASSWORD', 'MASTER_ADMIN_EMAIL',
  'REACT_APP_FIREBASE_PROJECT_ID', 'REACT_APP_TEST_FIREBASE_PROJECT_ID',
  'FIREBASE_TEST_SERVICE_ACCOUNT_KEY', 'FIREBASE_SERVICE_ACCOUNT_KEY', 'GOOGLE_APPLICATION_CREDENTIALS',
  'NODE_OPTIONS', 'NODE_PATH', 'GATE_HTTP_FIXTURE', 'GATE_HTTP_TRACE', 'ORPHAN_MARKER',
]);

const env = { ...process.env };
for (const key of AMBIENT_RELEASE_TEST_KEYS) delete env[key];
// Never inherit Node's private test-runner marker into the new top-level test process.
delete env.NODE_TEST_CONTEXT;

const result = cp.spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: root,
  env,
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error) {
  console.error(`Hermetic repair test runner failed to start: ${result.error.message}`);
  process.exit(1);
}
if (result.signal) {
  console.error(`Hermetic repair test runner ended by signal ${result.signal}.`);
  process.exit(1);
}
process.exit(Number.isInteger(result.status) ? result.status : 1);

module.exports = { AMBIENT_RELEASE_TEST_KEYS };
