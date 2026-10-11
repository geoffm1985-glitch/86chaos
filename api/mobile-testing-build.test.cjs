'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { testingEnvironment, verifyTestingServices } = require('../scripts/build-testing-apk.cjs');
test('testing APK overrides inherited production Firebase and both native API destinations', () => {
  const env = testingEnvironment({ REACT_APP_FIREBASE_DEPLOYMENT_MODE: 'production', REACT_APP_FIREBASE_ACTIVE_PROJECT_ID: 'cheers-34b8d', REACT_APP_NATIVE_API_BASE_URL: 'https://app.86chaos.com', REACT_APP_NATIVE_UPDATED_API_BASE_URL: 'https://production.example' });
  assert.equal(env.REACT_APP_FIREBASE_DEPLOYMENT_MODE, 'testing');
  assert.equal(env.REACT_APP_FIREBASE_ACTIVE_PROJECT_ID, 'chaos-test-d1601');
  assert.equal(env.REACT_APP_NATIVE_API_BASE_URL, 'https://testing.86chaos.com');
  assert.equal(env.REACT_APP_NATIVE_UPDATED_API_BASE_URL, 'https://testing.86chaos.com');
});
test('testing APK rejects a production Firebase Android registration', () => {
  assert.throws(() => verifyTestingServices({ project_info: { project_id: 'cheers-34b8d' }, client: [] }), /testing Firebase/);
  assert.throws(() => verifyTestingServices({ project_info: { project_id: 'chaos-test-d1601' }, client: [] }), /registration is missing/);
  assert.doesNotThrow(() => verifyTestingServices(require('../mobile/testing/google-services.json')));
});
