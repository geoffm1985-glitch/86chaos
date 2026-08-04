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
test('canonical platform admin access helper distinguishes verified pending temporary and denied states', async () => {
  const { WHOAMI_STATES, PLATFORM_ADMIN_ACCESS_STATES, resolvePlatformAdminAccessState } = await loadSessionAccess();
  const verified = resolvePlatformAdminAccessState({
    user: { id: 'root', email: 'geoffm1985@gmail.com' },
    verification: { ok: true, status: WHOAMI_STATES.VERIFIED, superAdmin: true, platformAuthority: { superAdmin: true, source: 'protected-root-admin' } },
    masterAdminEmail: 'geoffm1985@gmail.com'
  });
  assert.equal(verified.state, PLATFORM_ADMIN_ACCESS_STATES.VERIFIED);
  assert.equal(verified.canRenderProtectedControls, true);

  const pending = resolvePlatformAdminAccessState({
    user: { id: 'root', email: 'geoffm1985@gmail.com' },
    verification: { status: WHOAMI_STATES.PENDING },
    masterAdminEmail: 'geoffm1985@gmail.com'
  });
  assert.equal(pending.state, PLATFORM_ADMIN_ACCESS_STATES.PENDING);
  assert.equal(pending.showDrawerEntry, true);
  assert.equal(pending.canRenderProtectedControls, false);

  const temporary = resolvePlatformAdminAccessState({
    user: { id: 'root', email: 'geoffm1985@gmail.com' },
    verification: { status: WHOAMI_STATES.TRANSIENT_FAILURE, statusCode: 503, retryable: true },
    masterAdminEmail: 'geoffm1985@gmail.com'
  });
  assert.equal(temporary.state, PLATFORM_ADMIN_ACCESS_STATES.TEMPORARILY_UNAVAILABLE);
  assert.equal(temporary.canRenderProtectedControls, false);

  const denied = resolvePlatformAdminAccessState({
    user: { id: 'staff', email: 'staff@example.com', permissions: { systemAdmin: true, godmode: true } },
    verification: { status: WHOAMI_STATES.DENIED, statusCode: 403, definitive: true, superAdmin: false },
    masterAdminEmail: 'geoffm1985@gmail.com'
  });
  assert.equal(denied.state, PLATFORM_ADMIN_ACCESS_STATES.DENIED);
  assert.equal(denied.showDrawerEntry, false);
});
