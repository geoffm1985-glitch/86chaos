// 86 Chaos Playwright config for the rebuilt 15.1.10 safety suite.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: Number(process.env.CHAOS_WORKERS || 1),
  retries: Number(process.env.CHAOS_RETRIES || 0),
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/chaos-playwright-results.json' }],
  ],
  use: {
    baseURL: process.env.CHAOS_BASE_URL || process.env.APP_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 45000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  outputDir: 'test-results/playwright-artifacts',
});
