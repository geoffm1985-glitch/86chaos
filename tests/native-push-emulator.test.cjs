'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getFirestore } = require('firebase-admin/firestore');
const target = require('../scripts/86chaos-firebase-target.cjs');

test('native token self-repair authenticates against the Auth emulator and persists/readbacks in Firestore', { timeout: 120000 }, async () => {
  assert.equal(target.getFirebaseTarget().emulator, true, 'This integration test must never target live Firebase');
  const email = `native-push-${Date.now()}@example.test`;
  const response = await fetch(target.firebaseAuthRestUrl('demo-api-key', 'signUp'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'LocalNativePushTest123!', returnSecureToken: true }) });
  assert.equal(response.status, 200);
  const session = await response.json();
  const admin = require('../api/_firebase-project-admin.js');
  const app = admin.getAdminAppForProject('demo-86chaos', { requireCredentials: true });
  const db = getFirestore(app);
  const profile = db.collection('users').doc(session.localId);
  const handler = require('../api/push-token-repair.js');
  const call = async patch => {
    let status, body;
    const res = { setHeader() {}, status(value) { status = value; return this; }, json(value) { body = value; return this; } };
    await handler({ method: 'POST', headers: { authorization: `Bearer ${session.idToken}` }, body: { action: 'self-repair', profileDocId: session.localId, restaurantId: 'native-test', repairRequestId: 'native-registration', patch } }, res);
    return { status, body };
  };
  try {
    await profile.set({ uid: session.localId, email, restaurantId: 'native-test', pushNeedsRepair: true });
    for (const token of ['native-fcm-first', 'native-fcm-rotated']) {
      const result = await call({ fcmToken: token, 'pushDevices.android_native_test': { token, permission: 'granted', active: true, platform: 'android', host: 'testing.86chaos.com' }, notificationPermission: 'granted', pushNeedsRepair: false, pushForceServiceWorkerRefresh: false, pushRepairStatus: 'connected' });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.ok, true);
      const saved = (await profile.get()).data();
      assert.equal(saved.fcmToken, token);
      assert.equal(saved.pushDevices.android_native_test.token, token);
      assert.equal(saved.pushDevices.android_native_test.platform, 'android');
      assert.equal(saved.pushNeedsRepair, false);
    }
    const forbidden = await call({ isSuperAdmin: true, fcmToken: 'unauthorized-change' });
    assert.equal(forbidden.status, 400);
    assert.equal((await profile.get()).data().fcmToken, 'native-fcm-rotated');
  } finally {
    await profile.delete();
    await app.auth().deleteUser(session.localId);
    await app.delete();
  }
});
