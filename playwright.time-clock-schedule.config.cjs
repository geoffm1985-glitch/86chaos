const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.CHAOS_BROWSER_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';

module.exports = defineConfig({
  testDir: './tests/86chaos-targeted',
  testMatch: /time-clock-schedule-recovery\.spec\.cjs/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
