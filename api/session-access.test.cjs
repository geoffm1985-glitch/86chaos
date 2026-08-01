'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');

async function loadSessionAccess() {
  return import(pathToFileURL(path.join(__dirname, '..', 'src', 'core', 'sessionAccess.js')).href + `?t=${Date.now()}`);
}

test('temporary whoami failure does not hold the full authenticated app spinner forever', async () => {
  const { WHOAMI_STATES, shouldHoldAccessHydration } = await loadSessionAccess();
  assert.equal(shouldHoldAccessHydration({
    hasCachedSession: true,
    signedOut: false,
    authPending: false,
    profileLoading: false,
    membershipLoading: false,
    roleControlsHydrating: false,
    localUserLooksSystemAdmin: true,
    whoamiStatus: WHOAMI_STATES.TRANSIENT_FAILURE
  }), false);
  assert.equal(shouldHoldAccessHydration({ hasCachedSession: true, whoamiStatus: WHOAMI_STATES.PENDING }), true);
  assert.equal(shouldHoldAccessHydration({ hasCachedSession: true, whoamiStatus: WHOAMI_STATES.RETRYING }), true);
});

test('App shows scoped System Administrator verification after temporary failure instead of mounting protected data', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.js'), 'utf8');
  assert.match(app, /Retry Verification/);
  assert.match(app, /System Administrator check is temporarily unavailable/);
  assert.match(app, /activeTabState === 'godmode' && serverSaysSuperAdmin/);
  assert.doesNotMatch(app, /activeTabState === 'godmode' && \(hasLocalSystemAdminMarker \|\| serverSaysSuperAdmin\)/);
});
