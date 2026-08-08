const { defineConfig, devices } = require('@playwright/test');
const { RELEASE_TEST_MATCH, PWA_SPEC_PATTERN } = require('./scripts/86chaos-release-gate/release-test-universe.cjs');

const baseURL = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';

module.exports = defineConfig({
  testDir: './tests',
  testMatch: [...RELEASE_TEST_MATCH],
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: { baseURL },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] }, testIgnore: /21-runtime-code-coverage\.spec\.cjs|runtime-code-coverage/i },
    { name: 'edge-pwa', testMatch: PWA_SPEC_PATTERN, use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'firefox-pwa', testMatch: PWA_SPEC_PATTERN, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-pwa', testMatch: PWA_SPEC_PATTERN, use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-webkit-pwa', testMatch: PWA_SPEC_PATTERN, use: { ...devices['iPhone 13'] } },
  ],
});
