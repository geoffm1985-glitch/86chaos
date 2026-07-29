const fs = require('fs');
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const root = process.cwd();
const { ensureRunDir } = require('./scripts/86chaos-release-gate/run-context.cjs');
const { runDir, runId } = ensureRunDir();
const baseURL = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
const resultsRoot = path.join(root, 'test-results', '86chaos-play-store-failed-only', runId);
fs.mkdirSync(resultsRoot, { recursive: true });

// 16.0.53 failed-only release gate.
// This intentionally re-runs only the spec files and test titles that failed in
// 86chaos-release-gate-SLIM-UPLOAD-ME(6).zip. Use the full release gate before
// calling a build release-ready.
module.exports = defineConfig({
  testDir: './tests',
  testMatch: [
    '86chaos-full-audit/01-auth-route-health.spec.cjs',
    '86chaos-full-audit/02-permission-role-security.spec.cjs',
    '86chaos-full-audit/03-safe-button-crawl.spec.cjs',
    '86chaos-full-audit/04-schedule-math-oracle.spec.cjs',
    '86chaos-full-audit/05-schedule-builder-mutation.spec.cjs',
    '86chaos-full-audit/14-export-import-regression-graveyard.spec.cjs',
    '86chaos-release-gate/00-qa-restaurant-lifecycle.spec.cjs',
    '86chaos-release-gate/15-interactive-control-census.spec.cjs',
    '86chaos-release-gate/16-accessibility-release-gate.spec.cjs',
    '86chaos-release-gate/17-resilience-chunk-offline.spec.cjs',
    '86chaos-release-gate/20-firebase-cost-idempotency.spec.cjs',
    '86chaos-release-gate/21-runtime-code-coverage.spec.cjs',
    '86chaos-release-gate/22-security-headers-input-fuzz.spec.cjs'
  ],
  grep: /owner-like account logs in|no route shows unresolved placeholders|manager account does not see system admin|safe visible buttons|visible Schedule Builder text must expose seeded staff\/events|Schedule Builder shows seeded employees|known bug graveyard stays dead|System Administrator exposes the matching Platform Operations cleanup tool|every visible control has an accessible name and every mutating|every major route has zero serious or critical axe violations|forms expose labels|one failed lazy chunk|opening and reopening unchanged routes|route and safe-interaction crawl executes|visible non-password text fields tolerate/i,
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
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } }
  ]
});
