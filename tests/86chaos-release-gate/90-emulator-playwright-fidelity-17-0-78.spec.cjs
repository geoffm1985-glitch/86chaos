'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
test.describe('17.0.78 Yardmaster emulator browser fidelity repair', () => {
  test('release-gate coverage keeps managed-emulator browser fidelity mandatory', async () => {
    const pwa = read('tests/86chaos-release-gate/25-pwa-android-installability.spec.cjs');
    const notifications = read('tests/86chaos-release-gate/35-reminder-notification-certification.spec.cjs');
    const security = read('tests/86chaos-release-gate/22-security-headers-input-fuzz.spec.cjs');
    expect(pwa).toMatch(/isManagedYardmasterEmulator/);
    expect(pwa).toMatch(/toBe\('https:'\)/);
    expect(notifications).toMatch(/registration\.showNotification/);
    expect(security).toMatch(/max-age=/);
    expect(security).toMatch(/worker-src 'none'/);
  });
});
