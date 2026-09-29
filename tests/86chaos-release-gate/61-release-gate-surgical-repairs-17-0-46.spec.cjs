'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const pkg = require('../../package.json');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.49 release-gate readiness repairs are explicit and failed tests cannot retry', async () => {
  expect(pkg.version).toBe('17.0.49');
  for (const file of ['playwright.config.js', 'playwright.play-store-release.config.cjs', 'playwright.failed-release.config.cjs']) {
    expect(read(file)).toMatch(/retries:\s*0/);
  }
  expect(read('src/features/schedule.jsx')).toMatch(/configuredDeckTop/);
  expect(read('src/core/schedulePdf.js')).toMatch(/schedulePdfFontSubsets/);
  expect(read('src/features/intelligence.jsx')).toContain('data-testid="personal-reminder-form"');
  expect(read('scripts/86chaos-release-gate/provision-test-accounts.cjs')).toContain("preferences: { language: 'en' }");
  expect(read('scripts/run-pos-bridge-emulator-tests.cjs')).toContain("GCLOUD_PROJECT:'demo-pos-bridge',FIREBASE_ACTIVE_PROJECT_ID:'demo-pos-bridge',FIREBASE_PROJECT_ID:'demo-pos-bridge'");
  expect(read('api/release-browser-reliability.test.cjs')).toContain("getByTestId\\('schedule-request-off-tab'\\)");
  expect(read('api/release-gate-maturity-16-0-209.test.cjs')).toContain("schedule-copilot-warnings-tab");
});
