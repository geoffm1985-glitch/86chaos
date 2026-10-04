'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('17.0.78 managed emulator browser contracts stay isolated without weakening live certification', () => {
  const pwa = read('tests/86chaos-release-gate/25-pwa-android-installability.spec.cjs');
  const reminder = read('tests/86chaos-release-gate/35-reminder-notification-certification.spec.cjs');
  const security = read('tests/86chaos-release-gate/22-security-headers-input-fuzz.spec.cjs');
  const readiness = read('scripts/yardmaster-readiness.cjs');
  const index = read('src/index.js');
  assert.match(pwa, /isManagedYardmasterEmulator/);
  assert.match(pwa, /managedEmulator[\s\S]*toBe\('http:'\)[\s\S]*else[\s\S]*toBe\('https:'\)/);
  assert.match(pwa, /deployed release candidate must activate a service worker/i);
  assert.match(reminder, /registration\.showNotification/);
  assert.match(reminder, /Managed emulator must not activate the production messaging worker/);
  assert.match(security, /HSTS is intentionally absent on the non-release HTTP loopback emulator/);
  assert.match(security, /strictTransportSecurity[\s\S]*toMatch\(\/max-age=/);
  assert.match(readiness, /X-Content-Type-Options[\s\S]*nosniff/);
  assert.match(readiness, /X-Frame-Options[\s\S]*SAMEORIGIN/);
  assert.match(index, /firebaseRuntimeTarget === 'LIVE'[\s\S]*navigator\.serviceWorker\.register/);
});

test('17.0.78 exact browser-fidelity source repairs remain present', () => {
  const reminder = read('tests/86chaos-release-gate/35-reminder-notification-certification.spec.cjs');
  const sticky = read('tests/86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs');
  const cost = read('tests/e2e/cost-regression.spec.cjs');
  const requestOff = read('tests/e2e/schedule-request-off-management.spec.cjs');
  const prior = read('tests/86chaos-release-gate/89-server-certification-drift-17-0-77.spec.cjs');
  assert.match(reminder, /listener-backed reminder list[\s\S]*45_000/);
  assert.match(sticky, /schedule-builder-grid-shell[\s\S]*containmentRoom/);
  assert.match(cost, /Show directory/);
  assert.match(cost, /single-workspace owners expose the current workspace as a non-switching control/);
  assert.match(requestOff, /Seeded Request Off conflict must hydrate[\s\S]*45_000/);
  assert.match(prior, /schedule[\s\S]*toMatch\(\/assert\\\.equal/);
});
