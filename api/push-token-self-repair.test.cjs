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


test('legacy push repair request identity is stable when failure details change', () => {
  const base = { id: 'legacy@example.com', email: 'legacy@example.com', pushNeedsRepair: true, lastPushFailureCode: 'messaging/old', pushRepairStatus: 'repair-failed' };
  const context = { profileDocId: 'legacy@example.com', restaurantId: 'cheers', deviceId: 'web_phone', host: 'app.86chaos.com' };
  const first = helpers.buildStablePushRepairRequestId(base, context);
  const changed = helpers.buildStablePushRepairRequestId({ ...base, lastPushFailureCode: 'permission-denied', lastPushRepairError: 'new text', pushRepairStatus: 'sync-failed', lastPushTokenSyncAt: new Date().toISOString() }, context);
  assert.equal(first, changed);
});

test('new push repair nonce creates a new dismissal identity', () => {
  const context = { profileDocId: 'user-1', restaurantId: 'cheers', deviceId: 'web_phone', host: 'app.86chaos.com' };
  const first = helpers.buildStablePushRepairRequestId({ id: 'user-1', pushTokenRepairNonce: 'nonce-a' }, context);
  const second = helpers.buildStablePushRepairRequestId({ id: 'user-1', pushTokenRepairNonce: 'nonce-b' }, context);
  assert.notEqual(first, second);
});

test('legacy push repair identity does not change when profile hydration changes', () => {
  const user = { id: 'legacy@example.com', email: 'legacy@example.com', pushNeedsRepair: true };
  const fromAuthUid = helpers.buildStablePushRepairRequestId(user, { authUid: 'auth-123', profileDocId: 'auth-123', restaurantId: 'cheers', deviceId: 'web_phone', host: 'app.86chaos.com' });
  const hydratedLegacy = helpers.buildStablePushRepairRequestId(user, { authUid: 'auth-123', profileDocId: 'legacy@example.com', restaurantId: 'cheers', deviceId: 'web_phone', host: 'app.86chaos.com' });
  assert.equal(fromAuthUid, hydratedLegacy);
});

test('self repair readback verifies token, device, flags, and status before success', () => {
  const patch = {
    fcmToken: 'token-1',
    notificationPermission: 'granted',
    pushNeedsRepair: false,
    pushForceServiceWorkerRefresh: false,
    pushRepairStatus: 'connected',
    'pushDevices.web_phone': { token: 'token-1', permission: 'granted', active: true }
  };
  const ok = helpers.verifySelfRepairReadback({ ...patch, pushDevices: { web_phone: { token: 'token-1', permission: 'granted', active: true } } }, patch);
  assert.equal(ok.ok, true);
  const bad = helpers.verifySelfRepairReadback({ ...patch, fcmToken: 'other', pushDevices: { web_phone: { token: 'other', permission: 'granted' } } }, patch);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.includes('fcmToken'));
});

test('push repair link captures one-time intent and clears after terminal outcomes', () => {
  const fs = require('fs');
  const path = require('path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.js'), 'utf8');
  assert.match(app, /setPushRepairLinkRequest\(\{ requested: true, consumed: true, nonce, capturedNonce: nonce/);
  assert.match(app, /history\.replaceState\(\{[\s\S]*pushRepairConsumed: true/);
  assert.match(app, /const pushRepairRequestedByLink = Boolean\(pushRepairLinkRequest\.requested\)/);
  assert.match(app, /clearPushRepairLinkRequest\('repair-success'\)/);
  assert.match(app, /clearPushRepairLinkRequest\('dismissed'\)/);
});

test('copied repair links include a stable server nonce instead of only pushRepair=1', () => {
  const fs = require('fs');
  const path = require('path');
  const management = fs.readFileSync(path.join(__dirname, '..', 'src', 'features', 'management.jsx'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, 'push-token-repair.js'), 'utf8');
  assert.match(management, /pushRepairNonce/);
  assert.match(management, /repairUser\?\.pushTokenRepairNonce/);
  assert.match(api, /withRepairNonceInLink/);
  assert.match(api, /url\.searchParams\.set\('pushRepairNonce'/);
});
