'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./_push-token-self-repair-logic.cjs');

test('self push repair accepts a legacy profileDocId owned by the signed-in user', () => {
  const decoded = { uid: 'auth-123', email: 'legacy@example.com' };
  const profile = { id: 'legacy@example.com', email: 'legacy@example.com' };
  assert.equal(helpers.profileMatchesDecoded(profile, profile.id, decoded), true);
});

test('self push repair rejects another user profile', () => {
  const decoded = { uid: 'auth-123', email: 'legacy@example.com' };
  const profile = { id: 'other-user', email: 'other@example.com', uid: 'other-auth' };
  assert.equal(helpers.profileMatchesDecoded(profile, profile.id, decoded), false);
});

test('self push repair allows only push token and device fields', () => {
  const good = helpers.sanitizeSelfRepairPatch({
    fcmToken: 'token',
    pushNeedsRepair: false,
    pushForceServiceWorkerRefresh: false,
    'pushDevices.web_abc': { token: 'token', active: true }
  });
  assert.equal(good.ok, true);
  assert.equal(good.rejected.length, 0);
  const bad = helpers.sanitizeSelfRepairPatch({ role: 'System Administrator', 'permissions.godmode': true, 'pushDevices.bad id': {} });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.rejected.sort(), ['permissions.godmode', 'pushDevices.bad id', 'role'].sort());
});
