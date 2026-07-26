// Playwright runtime checks for 86 Chaos.
// Destructive suites must run only against local/emulator/QA targets, never production.
const { defineConfig, devices } = require('@playwright/test');

const rawBaseURL = process.env.CHAOS_E2E_BASE_URL || process.env.APP_URL || 'http://127.0.0.1:3000';
const baseURL = rawBaseURL.replace(/\/$/, '');
const isProduction = /(^https:\/\/app\.86chaos\.com\/?$)|(^https:\/\/86chaos\.com\/?$)/i.test(baseURL);
const allowProductionReadOnly = process.env.CHAOS_E2E_ALLOW_PRODUCTION_READONLY === 'true';

if (isProduction && !allowProductionReadOnly) {
  throw new Error('Refusing to run Playwright tests against production. Set CHAOS_E2E_BASE_URL to a local or QA URL.');
}

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000
  },
  webServer: process.env.CHAOS_E2E_SKIP_WEBSERVER === 'true' ? undefined : {
    command: 'npm start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      BROWSER: 'none',
      HOST: '127.0.0.1',
      PORT: new URL(baseURL).port || '3000'
    }
  },
  projects: [
    { name: 'chromium-1440x900', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'chromium-1024x768', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
    { name: 'mobile-chromium-390x844', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    { name: 'mobile-chromium-430x932', use: { ...devices['Pixel 5'], viewport: { width: 430, height: 932 } } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } }
  ]
});
