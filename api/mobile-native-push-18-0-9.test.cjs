'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const parser = require('@babel/parser');
const { createNativePushClient } = require('../src/core/nativePushClient.mjs');
const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'src/App.js'), 'utf8');
const ast = parser.parse(appSource, { sourceType: 'module', plugins: ['jsx'] });
const app = ast.program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
const names = ['saveNativePushToken', 'repairNativePushOnThisDevice', 'repairPushOnThisDevice'];
const actualHandlers = app.body.body.filter(node => node.type === 'VariableDeclaration' && names.includes(node.declarations[0]?.id?.name)).map(node => appSource.slice(node.start, node.end)).join('\n');

function harness({ platform = 'android', receive = 'prompt', available = true, saveError = false, token = 'native-fcm-token' } = {}) {
  const calls = [], writes = [], toasts = [], listeners = new Map();
  let savedUser = { id: 'profile-1' };
  const plugin = {
    checkPermissions: async () => { calls.push('check'); return { receive }; },
    requestPermissions: async () => { calls.push('request'); receive = 'granted'; return { receive }; },
    createChannel: async channel => { calls.push(['channel', channel.id]); },
    getToken: async () => { calls.push('token'); return { token }; },
    addListener: async (event, callback) => { listeners.set(event, callback); return { remove: async () => listeners.delete(event) }; }
  };
  const client = createNativePushClient({ getPlatform: () => platform, isAvailable: () => available, plugin, timeoutMs: 50 });
  const context = {
    nativePush: client, window: { location: { hostname: 'testing.86chaos.com' } },
    auth: { currentUser: { uid: 'auth-1' } }, ghostTenant: null, isDemoMode: false,
    liveAppUser: savedUser, nativePushSaveRef: { current: null },
    getPushProfileDocId: () => 'profile-1', getPushRepairRequestId: () => 'repair-1',
    buildPushDevicePatch: (currentToken, permission, stamp) => ({ deviceId: 'android_1', field: 'pushDevices.android_1', data: { token: currentToken, permission, active: true, platform, updatedAt: stamp } }),
    shouldWritePushDevice: () => true,
    writePushProfilePatch: async (patch, options) => { if (saveError) throw Error('Secure token save failed'); writes.push({ patch, options }); },
    setAppUser: updater => { savedUser = updater(savedUser); },
    setNativePushNeedsRepair: value => { context.needsRepair = value; },
    setPushRepairDismissed: value => { context.dismissed = value; },
    setIsPushRepairing: value => { context.repairing = value; },
    clearPushRepairLinkRequest: reason => calls.push(reason),
    addToast: (title, message) => toasts.push({ title, message }), module: { exports: {} }
  };
  vm.runInNewContext(actualHandlers + '\nmodule.exports = { repairPushOnThisDevice, saveNativePushToken };', context);
  return { client, calls, writes, toasts, listeners, context, handlers: context.module.exports };
}

for (const platform of ['android', 'ios']) test(`${platform}: actual App repair succeeds without window.Notification and securely saves native FCM`, async () => {
  const h = harness({ platform });
  assert.equal('Notification' in h.context.window, false);
  assert.equal(await h.handlers.repairPushOnThisDevice('manual'), true);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].patch.fcmToken, 'native-fcm-token');
  assert.equal(h.writes[0].patch.pushRepairStatus, 'connected');
  assert.equal(h.writes[0].patch['pushDevices.android_1'].platform, platform);
  assert.equal(h.writes[0].options.forceServerRepair, true);
  assert.equal(h.context.repairing, false);
  assert.equal(h.context.needsRepair, false);
  assert.ok(h.calls.includes('request'));
  assert.ok(h.toasts.some(toast => toast.title === 'Notifications Connected'));
});

test('denied native permission gives phone Settings guidance and never obtains or saves a token', async () => {
  const h = harness({ receive: 'denied' });
  assert.equal(await h.handlers.repairPushOnThisDevice(), false);
  assert.equal(h.writes.length, 0);
  assert.equal(h.calls.includes('token'), false);
  assert.match(h.toasts[0].message, /phone Settings/);
});

test('missing native plugin and failed server save never claim connected or blame login', async () => {
  for (const options of [{ available: false }, { receive: 'granted', saveError: true }]) {
    const h = harness(options);
    assert.equal(await h.handlers.repairPushOnThisDevice(), false);
    assert.equal(h.writes.length, 0);
    assert.equal(h.context.needsRepair, true);
    assert.equal(h.context.dismissed, undefined);
    assert.equal(h.toasts[0].title, 'Notification Connection Failed');
    assert.doesNotMatch(h.toasts[0].message, /real logged-in device/);
  }
});

test('automatic native connection never prompts, while manual connection can request permission', async () => {
  const h = harness();
  assert.equal((await h.client.connect()).permission, 'default');
  assert.equal(h.calls.includes('request'), false);
  assert.equal((await h.client.connect({ requestPermission: true })).token, 'native-fcm-token');
});

test('a refreshed native FCM token replaces the device token through the secured repair flow', async () => {
  const h = harness({ receive: 'granted' });
  const cleanup = await h.client.listen({ onToken: token => h.handlers.saveNativePushToken(token) });
  h.listeners.get('tokenReceived')({ token: 'rotated-native-token' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.writes[0].patch.fcmToken, 'rotated-native-token');
  assert.equal(h.writes[0].patch['pushDevices.android_1'].token, 'rotated-native-token');
  await cleanup();
  assert.equal(h.listeners.size, 0);
});

test('empty token and stalled registration fail without reporting notifications connected', async () => {
  const h = harness({ receive: 'granted', token: '' });
  assert.equal(await h.handlers.repairPushOnThisDevice(), false);
  assert.equal(h.writes.length, 0);
  const client = createNativePushClient({ getPlatform: () => 'ios', timeoutMs: 5, plugin: { checkPermissions: async () => ({ receive: 'granted' }), getToken: () => new Promise(() => {}) } });
  await assert.rejects(client.connect(), /timed out/);
});

test('signed-out and demo sessions cannot register their token on another account', async () => {
  const h = harness({ receive: 'granted' });
  h.context.auth.currentUser = null;
  assert.equal(await h.handlers.saveNativePushToken('token-after-logout'), false);
  h.context.isDemoMode = true;
  assert.equal(await h.handlers.repairPushOnThisDevice(), false);
  assert.equal(h.writes.length, 0);
});

test('preview packages the matching testing Firebase native configurations and bridge', () => {
  const services = JSON.parse(fs.readFileSync(path.join(root, 'android/app/google-services.json')));
  assert.equal(services.project_info.project_id, 'chaos-test-d1601');
  assert.equal(services.client[0].client_info.android_client_info.package_name, 'com.chiltonappworks.chaos86');
  const ios = fs.readFileSync(path.join(root, 'ios/App/App/GoogleService-Info.plist'), 'utf8');
  assert.match(ios, /chaos-test-d1601/);
  assert.match(ios, /com.chiltonappworks.chaos86/);
  const bridge = fs.readFileSync(path.join(root, 'src/core/nativePush.js'), 'utf8');
  assert.match(bridge, /registerPlugin\('FirebaseMessaging'\)/);
  assert.doesNotMatch(bridge, /from '@capacitor-firebase\/messaging'/);
  assert.match(appSource, /nativePush\.isNative\(\) \|\| !liveAppUser/);
});
