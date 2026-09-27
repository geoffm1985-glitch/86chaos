'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const pkg = require('../../package.json');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.46 release-gate repairs are explicit and failed tests cannot retry', async () => {
  expect(pkg.version).toBe('17.0.46');
  for (const file of ['playwright.config.js', 'playwright.play-store-release.config.cjs', 'playwright.failed-release.config.cjs']) {
    expect(read(file)).toMatch(/retries:\s*0/);
  }
  expect(read('src/features/schedule.jsx')).toMatch(/configuredDeckTop/);
  expect(read('src/core/schedulePdf.js')).toMatch(/schedulePdfFontSubsets/);
  expect(read('src/features/intelligence.jsx')).toContain('data-testid="personal-reminder-form"');
  expect(read('scripts/86chaos-release-gate/provision-test-accounts.cjs')).toContain("preferences: { language: 'en' }");
});
