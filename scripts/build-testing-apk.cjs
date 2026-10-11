'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const TEST_ORIGIN = 'https://testing.86chaos.com';
const TEST_PROJECT = 'chaos-test-d1601';
function testingEnvironment(parent = process.env) {
  return { ...parent, CI: 'false', GENERATE_SOURCEMAP: 'false',
    REACT_APP_FIREBASE_DEPLOYMENT_MODE: 'testing', REACT_APP_FIREBASE_ACTIVE_PROJECT_ID: TEST_PROJECT,
    REACT_APP_NATIVE_API_BASE_URL: TEST_ORIGIN, REACT_APP_NATIVE_UPDATED_API_BASE_URL: TEST_ORIGIN };
}
function verifyTestingServices(services) {
  assert.equal(services.project_info.project_id, TEST_PROJECT, 'Testing APK requires testing Firebase');
  assert(services.client.some(client => client.client_info.android_client_info.package_name === 'com.chiltonappworks.chaos86'), 'Testing Firebase Android registration is missing');
}
module.exports = { testingEnvironment, verifyTestingServices };
if (require.main === module) { console.error('Testing Firebase APKs are forbidden. Use npm run build:android:production.'); process.exitCode = 1; }
