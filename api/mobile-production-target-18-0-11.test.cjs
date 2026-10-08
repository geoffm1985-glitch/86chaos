'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = fs.readFileSync('src/core/appCore.js', 'utf8');
const configSource = core.slice(core.indexOf('const env ='), core.indexOf('export const app = initializeApp'))
  .replace(/export const /g, 'const ');
function select(host, emulator = false) {
  return vm.runInNewContext(configSource + '\nfirebaseConfig.projectId;', {
    process: { env: { REACT_APP_FIREBASE_DEPLOYMENT_MODE: 'production', REACT_APP_FIREBASE_ACTIVE_PROJECT_ID: 'cheers-34b8d' } },
    window: { location: { hostname: host } },
    assertFirebaseEmulatorBrowserHost() {}, isFirebaseEmulatorTarget: emulator,
    firebaseEmulatorSettings: { projectId: 'demo-86chaos' }, firebaseRuntimeTarget: emulator ? 'EMULATOR' : 'LIVE'
  });
}
test('production native origin selects live Firebase while local and emulator tests stay isolated', () => {
  assert.equal(select('app.86chaos.com'), 'cheers-34b8d');
  for (const host of ['localhost', '127.0.0.1', 'testing.86chaos.com', '86chaos-preview.vercel.app']) {
    assert.equal(select(host), 'chaos-test-d1601');
    assert.equal(select(host, true), 'demo-86chaos');
  }
});
test('production native FCM and browser auth/data identify the same Firebase project', () => {
  const android = JSON.parse(fs.readFileSync('android/app/google-services.json'));
  const ios = fs.readFileSync('ios/App/App/GoogleService-Info.plist', 'utf8');
  const cap = JSON.parse(fs.readFileSync('capacitor.config.json'));
  assert.equal(android.project_info.project_id, 'cheers-34b8d');
  assert.equal(String(android.project_info.project_number), '762225019248');
  assert.match(android.client[0].client_info.mobilesdk_app_id, /^1:762225019248:android:/);
  assert.match(ios, /1:762225019248:ios:/);
  assert.match(ios, /<string>cheers-34b8d<\/string>/);
  assert.equal(cap.server.hostname, 'app.86chaos.com');
  assert.match(core, /NATIVE_API_BASE_URL[^\n]+https:\/\/app\.86chaos\.com/);
});
