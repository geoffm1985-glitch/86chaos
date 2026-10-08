'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const clientSource = fs.readFileSync(path.join(root, 'src/core/nativePushClient.mjs'), 'utf8').replace(/export \{[^}]+\};/, '');
const capacitorSource = fs.readFileSync(path.join(root, 'node_modules/@capacitor/core/dist/index.js'), 'utf8').replace(/export \{[^}]+\};/, '');

async function prepare(page, project, receive = 'prompt') {
  await page.goto('/version.json');
  await page.evaluate(({ capacitorSource, clientSource, platform, receive }) => {
    const calls = [], callbacks = new Map();
    let token = 'initial-native-fcm';
    window.CapacitorCustomPlatform = { name: platform };
    window.Capacitor = {
      PluginHeaders: [{ name: 'FirebaseMessaging', methods: [...['checkPermissions', 'requestPermissions', 'getToken', 'createChannel', 'removeListener'].map(name => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }] }],
      nativePromise: async (_, method, options) => {
        calls.push(method);
        if (method === 'checkPermissions') return { receive };
        if (method === 'requestPermissions') { receive = 'granted'; return { receive }; }
        if (method === 'getToken') return { token };
        if (method === 'removeListener') callbacks.delete(options.eventName);
        return {};
      },
      nativeCallback: async (_, method, options, callback) => {
        if (method === 'addListener') callbacks.set(options.eventName, callback);
        return options.eventName;
      }
    };
    const core = new Function(capacitorSource + '; return { Capacitor, registerPlugin };')();
    const client = new Function(clientSource + '; return { createNativePushClient };')();
    window.nativePushHarness = {
      calls, callbacks,
      client: client.createNativePushClient({ getPlatform: core.Capacitor.getPlatform, isAvailable: () => core.Capacitor.isPluginAvailable('FirebaseMessaging'), plugin: core.registerPlugin('FirebaseMessaging') }),
      rotate: value => { token = value; callbacks.get('tokenReceived')?.({ token }); }
    };
  }, { capacitorSource, clientSource, platform: project.includes('ios') ? 'ios' : 'android', receive });
}

test('native permission and FCM registration use the Capacitor bridge on Android and iPhone', async ({ page }, testInfo) => {
  await prepare(page, testInfo.project.name);
  const result = await page.evaluate(async () => {
    const { client, calls } = window.nativePushHarness;
    const automatic = await client.connect();
    const promptedBeforeManual = calls.includes('requestPermissions');
    const manual = await client.connect({ requestPermission: true });
    return { automatic, promptedBeforeManual, manual, calls };
  });
  expect(result.automatic).toEqual({ permission: 'default', token: null });
  expect(result.promptedBeforeManual).toBe(false);
  expect(result.manual).toEqual({ permission: 'granted', token: 'initial-native-fcm' });
  expect(result.calls).toContain('requestPermissions');
  if (testInfo.project.name.includes('android')) expect(result.calls).toContain('createChannel');
});

test('native denied permission never fetches a token or creates a success result', async ({ page }, testInfo) => {
  await prepare(page, testInfo.project.name, 'denied');
  const result = await page.evaluate(async () => ({ result: await window.nativePushHarness.client.connect({ requestPermission: true }), calls: window.nativePushHarness.calls }));
  expect(result.result).toEqual({ permission: 'denied', token: null });
  expect(result.calls).not.toContain('getToken');
  expect(result.calls).not.toContain('requestPermissions');
});

test('native token rotation, notification tap and foreground listeners clean up their own subscriptions', async ({ page }, testInfo) => {
  await prepare(page, testInfo.project.name, 'granted');
  const result = await page.evaluate(async () => {
    const h = window.nativePushHarness;
    const tokens = [], actions = [], notifications = [];
    const cleanup = await h.client.listen({ onToken: token => tokens.push(token), onAction: notification => actions.push(notification.data.url), onNotification: notification => notifications.push(notification.body) });
    h.rotate('new-native-fcm');
    h.callbacks.get('notificationActionPerformed')({ notification: { data: { url: '/?tab=messages' } } });
    h.callbacks.get('notificationReceived')({ notification: { body: 'New schedule published' } });
    await cleanup();
    return { tokens, actions, notifications, remaining: h.callbacks.size };
  });
  expect(result.tokens).toEqual(['new-native-fcm']);
  expect(result.actions).toEqual(['/?tab=messages']);
  expect(result.notifications).toEqual(['New schedule published']);
  expect(result.remaining).toBe(0);
});
