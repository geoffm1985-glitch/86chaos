'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertDeploymentBoundary } = require('../src/core/deploymentBoundary.cjs');
test('testing cannot select production through project, native resources or a stale config', () => {
  assert.throws(() => assertDeploymentBoundary({ branch: 'testing', projectId: 'cheers-34b8d' }), { code: 'firebase_environment_mismatch' });
  for (const key of ['authDomain','storageBucket','databaseURL']) {
    assert.throws(() => assertDeploymentBoundary({ hostname: 'testing.86chaos.com', projectId: 'chaos-test-d1601', [key]: 'cheers-34b8d.firebaseapp.com' }));
  }
  assert.equal(assertDeploymentBoundary({ branch: 'testing', projectId: 'chaos-test-d1601' }).environment, 'testing');
  assert.throws(() => assertDeploymentBoundary({ branch: 'testing', projectId: 'chaos-test-d1601', authDomain: 'chaos-test-d1601.attacker.example' }));
});

test('testing Admin refuses production resources and mismatched split credentials before initialization', () => {
  const api = require('./_firebase-project-admin');
  const keys = [...new Set(['VERCEL_GIT_COMMIT_REF', 'FIREBASE_TEST_DATABASE_URL', 'FIREBASE_TEST_STORAGE_BUCKET', 'FIREBASE_TEST_PROJECT_ID', 'FIREBASE_TEST_CLIENT_EMAIL', 'FIREBASE_TEST_PRIVATE_KEY', ...Object.keys(process.env).filter(key => /FIREBASE.*(KEY|CREDENTIAL|ACCOUNT)|TEST.*FIREBASE|GOOGLE.*CREDENTIAL/.test(key))])];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    process.env.VERCEL_GIT_COMMIT_REF = 'testing';
    process.env.FIREBASE_TEST_DATABASE_URL = 'https://cheers-34b8d-default-rtdb.firebaseio.com';
    assert.throws(() => api.getAdminAppForProject('chaos-test-d1601'), { code: 'firebase_environment_mismatch' });
    delete process.env.FIREBASE_TEST_DATABASE_URL;
    process.env.FIREBASE_TEST_STORAGE_BUCKET = 'cheers-34b8d.appspot.com';
    assert.throws(() => api.getAdminAppForProject('chaos-test-d1601'), { code: 'firebase_environment_mismatch' });
    delete process.env.FIREBASE_TEST_STORAGE_BUCKET;
    process.env.FIREBASE_TEST_PROJECT_ID = 'cheers-34b8d';
    process.env.FIREBASE_TEST_CLIENT_EMAIL = 'unit@example.invalid';
    process.env.FIREBASE_TEST_PRIVATE_KEY = 'unit-key-never-used';
    assert.throws(() => api.readProjectCredential('chaos-test-d1601'), { code: 'firebase_environment_mismatch' });
  } finally {
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
});
test('APK boundary remains production even when source branch is testing', () => {
  assert.equal(assertDeploymentBoundary({ branch: 'testing', native: true, projectId: 'cheers-34b8d', apiBaseUrl: 'https://app.86chaos.com' }).environment, 'production');
  assert.throws(() => assertDeploymentBoundary({ native: true, projectId: 'chaos-test-d1601' }));
  assert.throws(() => assertDeploymentBoundary({ native: true, projectId: 'cheers-34b8d', apiBaseUrl: 'https://testing.86chaos.com' }));
});
test('isolated emulator contracts cannot select a live project', () => {
  assert.equal(assertDeploymentBoundary({ emulator: true, projectId: 'demo-86chaos' }).environment, 'emulator');
  assert.throws(() => assertDeploymentBoundary({ emulator: true, projectId: 'cheers-34b8d' }));
});
test('testing rejects a production token before any Admin app can be selected', () => {
  const api = require('./_firebase-project-admin');
  const jwt = ['e30', Buffer.from(JSON.stringify({ aud: 'cheers-34b8d' })).toString('base64url'), 'signature'].join('.');
  assert.throws(() => api.getRequestedProjectId({ headers: { host: 'testing.86chaos.com', authorization: `Bearer ${jwt}` } }), { code: 'firebase_environment_mismatch' });
});

test('testing server requests select testing even when a generic credential is stale', () => {
  const api = require('./_firebase-project-admin');
  const saved = { ref: process.env.VERCEL_GIT_COMMIT_REF, credential: process.env.FIREBASE_SERVICE_ACCOUNT_KEY };
  try {
    process.env.VERCEL_GIT_COMMIT_REF = 'testing';
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({ project_id: 'cheers-34b8d' });
    assert.equal(api.getRequestedProjectId({ headers: {} }), 'chaos-test-d1601');
    assert.throws(() => api.getRequestedProjectId({ headers: {} }, 'cheers-34b8d'), { code: 'firebase_environment_mismatch' });
    assert.throws(() => api.getAdminAppForProject('cheers-34b8d'), { code: 'firebase_environment_mismatch' });
  } finally {
    for (const [name, value] of [['VERCEL_GIT_COMMIT_REF', saved.ref], ['FIREBASE_SERVICE_ACCOUNT_KEY', saved.credential]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
