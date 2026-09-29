'use strict';
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.46 release configs execute every Playwright identity at most once', () => {
  for (const file of ['playwright.config.js', 'playwright.play-store-release.config.cjs', 'playwright.failed-release.config.cjs']) {
    const source = read(file);
    assert.match(source, /retries:\s*0/);
    assert.doesNotMatch(source, /retries:\s*process\.env\.CI/);
  }
});

test('17.0.46 browser repairs preserve stable release-gate contracts', () => {
  const schedule = read('src/features/schedule.jsx');
  const reminders = read('src/features/intelligence.jsx');
  const pdf = read('src/core/schedulePdf.js');
  const provisioner = read('scripts/86chaos-release-gate/provision-test-accounts.cjs');
  assert.match(schedule, /data-testid=\{tab === 'time-off' \? 'schedule-request-off-tab'/);
  assert.match(schedule, /schedule-copilot-warnings-tab/);
  assert.match(schedule, /configuredDeckTop/);
  assert.match(reminders, /data-testid="personal-reminder-form"/);
  assert.match(reminders, /aria-label=\{editing\?'Save reminder':'Add reminder'\}/);
  assert.match(pdf, /schedulePdfFontSubsets/);
  assert.match(pdf, /fontAssetCache/);
  assert.match(provisioner, /preferences:\s*\{ language: 'en' \}/);
});

test('historical browser checks compare deployments with the active release identity', () => {
  for (const file of [
    'tests/86chaos-release-gate/42-merged-17-0-30-parity.spec.cjs',
    'tests/86chaos-release-gate/45-firebase-admin-url-api.spec.cjs',
    'tests/86chaos-release-gate/46-firebase-admin-runtime-module-load.spec.cjs',
    'tests/86chaos-new-implementations/10-app-bootstrap-i18n-runtime.spec.cjs',
  ]) assert.match(read(file), /pkg\.version/);
});

test('17.0.49 pre-Playwright gate repairs isolate emulator identity and preserve current stable controls', () => {
  const emulatorRunner = read('scripts/run-pos-bridge-emulator-tests.cjs');
  const reliability = read('api/release-browser-reliability.test.cjs');
  const maturity207 = read('api/release-gate-maturity-16-0-207.test.cjs');
  const maturity209 = read('api/release-gate-maturity-16-0-209.test.cjs');
  assert.match(emulatorRunner, /GCLOUD_PROJECT:'demo-pos-bridge',FIREBASE_ACTIVE_PROJECT_ID:'demo-pos-bridge',FIREBASE_PROJECT_ID:'demo-pos-bridge'/);
  assert.match(reliability, /schedule-request-off-tab/);
  assert.match(maturity207, /schedule-copilot-warnings-tab/);
  assert.match(maturity207, /role="tab"\[\\s\\S\]\{0,180\}aria-label/);
  assert.match(maturity209, /schedule-copilot-warnings-tab/);
  assert.doesNotMatch(maturity209, /getByRole\\\('tab'.*Warnings/);
});

test('17.0.50 source validator uses literal release identity checks instead of over-escaped regexes', () => {
  const validator = read('scripts/validate-17-0-50.js');
  assert.ok(validator.includes("includes(\"const APP_VERSION = '17.0.50';\")"));
  assert.ok(validator.includes("includes(\"const SECURITY_SCHEMA_VERSION = '17.0.50';\")"));
  assert.ok(validator.includes("includes(\"const APP_RELEASE = '17.0.50';\")"));
  assert.ok(validator.includes("includes(\"export const CURRENT_VERSION = '17.0.50';\")"));
  assert.doesNotMatch(validator, /APP_VERSION = '17\\\\\\\\\.0/);
});

