const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const root = process.cwd();
const resultsRoot = path.join(root, 'test-results', '86chaos-play-store-release-gate');
const baseURL = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.BASE_URL || '';

module.exports = defineConfig({
  testDir: './tests',
  globalSetup: './tests/86chaos-release-gate/global-setup.cjs',
  globalTeardown: './tests/86chaos-release-gate/global-teardown.cjs',
  timeout: 300000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  forbidOnly: true,
  maxFailures: 0,
  retries: process.env.CI ? 2 : 0,
  workers: Number(process.env.CHAOS_RELEASE_GATE_WORKERS || 1),
  outputDir: path.join(resultsRoot, 'artifacts'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(resultsRoot, 'playwright-report.json') }],
    ['html', { outputFolder: path.join(resultsRoot, 'html'), open: 'never' }],
  ],
  use: {
    baseURL,
    headless: !/^(1|true|yes)$/i.test(process.env.CHAOS_HEADED || ''),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.CHAOS_VIDEO === 'off' ? 'off' : 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 60000,
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    ignoreHTTPSErrors: false,
  },
  projects: [
    {
      name: 'chromium-full-1440',
      testMatch: [
        /86chaos-full-audit\/.*\.spec\.cjs/,
        /86chaos-release-gate\/.*\.spec\.cjs/,
      ],
      testIgnore: [/cross-browser/],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-1024',
      testMatch: /86chaos-cross-browser\/.*\.spec\.cjs/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } },
    },
    {
      name: 'chromium-mobile-390',
      testMatch: /86chaos-cross-browser\/.*\.spec\.cjs/,
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'chromium-mobile-430',
      testMatch: /86chaos-cross-browser\/.*\.spec\.cjs/,
      use: { ...devices['Galaxy S9+'], viewport: { width: 430, height: 932 } },
    },
    {
      name: 'firefox-desktop',
      testMatch: /86chaos-cross-browser\/.*\.spec\.cjs/,
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'webkit-desktop',
      testMatch: /86chaos-cross-browser\/.*\.spec\.cjs/,
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
