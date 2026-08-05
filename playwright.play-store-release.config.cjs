const fs = require('fs');
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const root = process.cwd();
const { ensureRunDir } = require('./scripts/86chaos-release-gate/run-context.cjs');
const { runDir, runId } = ensureRunDir();
const baseURL = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
const resultsRoot = runDir;
fs.mkdirSync(resultsRoot, { recursive: true });

module.exports = defineConfig({
  testDir: './tests',
  testMatch: [
    '86chaos-full-audit/**/*.spec.cjs',
    '86chaos-release-gate/**/*.spec.cjs'
  ],
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  globalSetup: require.resolve('./tests/86chaos-release-gate/global-setup.cjs'),
  globalTeardown: require.resolve('./tests/86chaos-release-gate/global-teardown.cjs'),
  outputDir: path.join(resultsRoot, 'playwright-artifacts'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(resultsRoot, 'playwright-report.json') }],
    ['html', { outputFolder: path.join(resultsRoot, 'html-report'), open: 'never' }]
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] }, testIgnore: /21-runtime-code-coverage\.spec\.cjs/ }
  ]
});
