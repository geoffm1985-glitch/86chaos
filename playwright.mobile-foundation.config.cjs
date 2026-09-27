const { defineConfig, devices } = require('@playwright/test');

const baseURL =
  process.env.APP_URL ||
  process.env.CHAOS_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.BASE_URL ||
  'http://127.0.0.1:3000';

module.exports = defineConfig({
  testDir: './tests/86chaos-release-gate',
  testMatch: /(58-native-mobile-cost-foundation|59-native-packaged-api-bridge)\.spec\.cjs/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  projects: [
    { name: 'native-android', use: { ...devices['Pixel 5'] } },
    { name: 'native-ios-webkit', use: { ...devices['iPhone 13'] } }
  ]
});
