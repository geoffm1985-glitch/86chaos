'use strict';

const fs = require('fs');
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const { ensureRunDir } = require('./scripts/86chaos-release-gate/run-context.cjs');

const { runDir } = ensureRunDir();
const baseURL = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
const outputDir = path.join(runDir, 'ultimate-playwright-artifacts');
fs.mkdirSync(outputDir, { recursive: true });

const timerReporter = path.join(process.cwd(), 'test-tools', 'reporters', 'playwright-live-timer.cjs');
const smokeMatches = [
  '**/86chaos-cross-browser/**/*.spec.cjs',
  '**/86chaos-ultimate-store/26-app-store-shell-cross-browser.spec.cjs',
  '**/86chaos-ultimate-store/27-responsive-readability-matrix.spec.cjs',
];
const mobileMatches = [
  '**/86chaos-full-audit/11-mobile-desktop-voice-upload.spec.cjs',
  '**/86chaos-release-gate/16-accessibility-release-gate.spec.cjs',
  '**/86chaos-release-gate/25-pwa-android-installability.spec.cjs',
  '**/86chaos-ultimate-store/26-app-store-shell-cross-browser.spec.cjs',
  '**/86chaos-ultimate-store/27-responsive-readability-matrix.spec.cjs',
  '**/86chaos-ultimate-store/30-error-language-and-recovery.spec.cjs',
];

module.exports = defineConfig({
  testDir: './tests',
  testMatch: [
    '**/86chaos-full-audit/**/*.spec.cjs',
    '**/86chaos-release-gate/**/*.spec.cjs',
    '**/86chaos-cross-browser/**/*.spec.cjs',
    '**/86chaos-ultimate-store/**/*.spec.cjs',
    '**/e2e/**/*.spec.cjs',
  ],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 1,
  globalSetup: require.resolve('./tests/86chaos-release-gate/global-setup.cjs'),
  globalTeardown: require.resolve('./tests/86chaos-release-gate/global-teardown.cjs'),
  outputDir,
  reporter: [
    [timerReporter, { tickMs: 1000 }],
    ['list'],
    ['json', { outputFile: path.join(runDir, 'playwright-report.json') }],
    ['junit', { outputFile: path.join(runDir, 'ultimate-playwright-junit.xml') }],
    ['html', { outputFolder: path.join(runDir, 'ultimate-html-report'), open: 'never' }],
  ],
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    serviceWorkers: 'allow',
  },
  projects: [
    {
      name: 'chromium-full',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'desktop-compact-chromium',
      testMatch: smokeMatches,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'mobile-chromium',
      testMatch: mobileMatches,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-small-chromium',
      testMatch: mobileMatches,
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 640 } },
    },
    {
      name: 'mobile-landscape-chromium',
      testMatch: smokeMatches,
      use: { ...devices['Pixel 7'], viewport: { width: 915, height: 412 } },
    },
    {
      name: 'tablet-chromium',
      testMatch: smokeMatches,
      use: { ...devices['iPad (gen 7)'], browserName: 'chromium' },
    },
    {
      name: 'firefox-smoke',
      testMatch: smokeMatches,
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'webkit-smoke',
      testMatch: smokeMatches,
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-webkit-iphone',
      testMatch: mobileMatches,
      use: { ...devices['iPhone 13'] },
    },
  ],
});
