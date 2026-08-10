const fs = require('fs');
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const chaosReleaseGateReporter = require.resolve('./test-tools/reporters/chaos-release-gate-reporter.cjs');
const { PWA_SPEC_PATTERN } = require('./scripts/86chaos-release-gate/release-test-universe.cjs');

const { ensureRunDir, getFailedOnlyManifestPath } = require('./scripts/86chaos-release-gate/run-context.cjs');
const { generatePlaywrightInventory } = require('./scripts/86chaos-release-gate/playwright-inventory.cjs');
const { FAILED_ONLY_TESTS, FAILED_ONLY_MANIFEST_ERRORS, FAILED_ONLY_MANIFEST_PATH, specsFromManifest, grepForProject } = require('./tests/86chaos-release-gate/failed-only-manifest.cjs');

const { runDir, runId } = ensureRunDir();
const baseURL = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
const resultsRoot = path.join(runDir, 'failed-only');
fs.mkdirSync(resultsRoot, { recursive: true });
generatePlaywrightInventory({ root: process.cwd(), outputPath: path.join(runDir, 'playwright-test-inventory.json'), runId, config: 'playwright.inventory.config.cjs' });

if (!FAILED_ONLY_TESTS.length) {
  throw new Error(`Failed-only manifest selected zero tests. Refusing to run a false-green diagnostic gate. ${FAILED_ONLY_MANIFEST_ERRORS.join('; ')}`);
}
const releaseSelectionMode = process.env.CHAOS_RELEASE_GATE_SELECTION_MODE || 'failed+new';
function reportedProject(row = {}) {
  return row.project || (row.projects || [])[0] || '';
}

function assertReportedFailedOnlySelection(rows = []) {
  if (releaseSelectionMode !== 'reported-failed-only') return;
  const desktop = rows.filter(item => (item.projects || []).includes('chromium') || item.project === 'chromium').length;
  const mobile = rows.filter(item => (item.projects || []).includes('mobile-chromium') || item.project === 'mobile-chromium').length;
  const stableKeys = rows.map(row => row.stableKey || `${row.specPath || row.spec || ''}\u0000${row.fullSuitePath || ''}\u0000${row.leafTitle || row.exactTestTitle || row.title || ''}\u0000${reportedProject(row)}`);
  const errors = [];
  if (rows.length !== 10) errors.push(`expected 10 selected FAIL identities, got ${rows.length}`);
  if (desktop !== 4) errors.push(`expected 4 chromium identities, got ${desktop}`);
  if (mobile !== 6) errors.push(`expected 6 mobile-chromium identities, got ${mobile}`);
  if (rows.some(item => String(item.priorStatus || '').toLowerCase() !== 'failed')) errors.push('reported-failed-only selected a non-failed priorStatus');
  if (rows.some(item => String(item.baselineStatus || '').toLowerCase() !== 'failed')) errors.push('reported-failed-only selected a non-failed baselineStatus');
  if (rows.some(item => String(item.priorStatus || '').toLowerCase() === 'timedout' || String(item.priorStatus || '').toLowerCase() === 'timeout')) errors.push('reported-failed-only selected a timeout status');
  if (rows.some(item => item.selectionReasons?.some(reason => /previous_timeout|timeout|current_release_feature_test|new_test|repair/i.test(String(reason))))) errors.push('reported-failed-only selected a timeout/current-release/new/repair reason');
  const badProjects = rows.filter(item => !['chromium', 'mobile-chromium'].includes(reportedProject(item)));
  if (badProjects.length) errors.push(`unexpected projects selected: ${[...new Set(badProjects.map(reportedProject))].join(', ')}`);
  if (new Set(stableKeys).size !== stableKeys.length) errors.push('duplicate stable identities selected');
  if (errors.length) throw new Error(`reported-failed-only selection must be exactly the 10 current FAIL identities from 20260809-233053: ${errors.join('; ')}`);
}


assertReportedFailedOnlySelection(FAILED_ONLY_TESTS);

const manifest = {
  ok: true,
  generatedAt: new Date().toISOString(),
  runId,
  runDir,
  mode: releaseSelectionMode,
  sourceManifestPath: FAILED_ONLY_MANIFEST_PATH,
  selected: FAILED_ONLY_TESTS,
  desktopSelected: FAILED_ONLY_TESTS.filter(item => (item.projects || []).includes('chromium')).length,
  mobileSelected: FAILED_ONLY_TESTS.filter(item => (item.projects || []).includes('mobile-chromium')).length,
  note: releaseSelectionMode === 'reported-failed-only'
    ? 'reported-failed-only runs only the 10 FAIL identities from 20260809-233053 and excludes TIMEOUT, PASS, and SKIP identities.'
    : `${releaseSelectionMode} success is diagnostic only. Complete npm run test:play-store is still required for release approval.`
};
fs.writeFileSync(path.join(runDir, 'failed-only-playwright-selection.json'), JSON.stringify(manifest, null, 2));
// Human-readable selected-test output is emitted once by the ASCII release-gate reporter.

const allProjects = [
  { name: 'chromium', grep: grepForProject(FAILED_ONLY_TESTS, 'chromium'), use: { ...devices['Desktop Chrome'] } },
  { name: 'mobile-chromium', grep: grepForProject(FAILED_ONLY_TESTS, 'mobile-chromium'), use: { ...devices['Pixel 5'] } },
  { name: 'edge-pwa', grep: grepForProject(FAILED_ONLY_TESTS, 'edge-pwa'), testMatch: PWA_SPEC_PATTERN, use: { ...devices['Desktop Edge'], channel: 'msedge' } },
  { name: 'firefox-pwa', grep: grepForProject(FAILED_ONLY_TESTS, 'firefox-pwa'), testMatch: PWA_SPEC_PATTERN, use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit-pwa', grep: grepForProject(FAILED_ONLY_TESTS, 'webkit-pwa'), testMatch: PWA_SPEC_PATTERN, use: { ...devices['Desktop Safari'] } },
  { name: 'mobile-webkit-pwa', grep: grepForProject(FAILED_ONLY_TESTS, 'mobile-webkit-pwa'), testMatch: PWA_SPEC_PATTERN, use: { ...devices['iPhone 13'] } }
];
const selectedProjects = releaseSelectionMode === 'reported-failed-only'
  ? allProjects.filter(project => ['chromium', 'mobile-chromium'].includes(project.name))
  : allProjects;

module.exports = defineConfig({
  testDir: './tests',
  testMatch: specsFromManifest(FAILED_ONLY_TESTS),
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
    [chaosReleaseGateReporter],
    ['json', { outputFile: path.join(runDir, 'playwright-report.json') }],
    ['html', { outputFolder: path.join(resultsRoot, 'html-report'), open: 'never' }]
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: selectedProjects
});
