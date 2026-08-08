const fs = require('fs');
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const { RELEASE_TEST_MATCH, PWA_SPEC_PATTERN } = require('./scripts/86chaos-release-gate/release-test-universe.cjs');

const root = process.cwd();
const { ensureRunDir } = require('./scripts/86chaos-release-gate/run-context.cjs');
const { runDir, runId } = ensureRunDir();
const { generatePlaywrightInventory } = require('./scripts/86chaos-release-gate/playwright-inventory.cjs');
const { buildCriticalInventory } = require('./scripts/86chaos-release-gate/critical-test-inventory.cjs');
const baseURL = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
const resultsRoot = runDir;
fs.mkdirSync(resultsRoot, { recursive: true });
if (process.env.CHAOS_INVENTORY_DISCOVERY !== '1') {
  generatePlaywrightInventory({ root, outputPath: path.join(resultsRoot, 'playwright-test-inventory.json'), runId, config: 'playwright.inventory.config.cjs' });
}
buildCriticalInventory({ outputPath: path.join(resultsRoot, 'release-critical-test-inventory.json'), runId });

module.exports = defineConfig({
  testDir: './tests',
  testMatch: [...RELEASE_TEST_MATCH],
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
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] }, testIgnore: /21-runtime-code-coverage\.spec\.cjs/ },
    { name: 'edge-pwa', testMatch: PWA_SPEC_PATTERN, use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'firefox-pwa', testMatch: PWA_SPEC_PATTERN, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-pwa', testMatch: PWA_SPEC_PATTERN, use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-webkit-pwa', testMatch: PWA_SPEC_PATTERN, use: { ...devices['iPhone 13'] } }
  ]
});
