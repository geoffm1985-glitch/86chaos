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
function assertReportedFailedOnlySelection(rows = []) {
  if (releaseSelectionMode !== 'reported-failed-only') return;
  const excludedPassingTitles = new Set([
    'Schedule Builder warning runtime renders without Runtime Recovery or TypeError',
    'Schedule Builder requested-off warning shows employee name and never Someone',
    'Schedule Builder coverage warnings show under and over target math',
    'Schedule Builder warning dismissal hides only the warning',
  ]);
  const desktop = rows.filter(item => (item.projects || []).includes('chromium') || item.project === 'chromium').length;
  const mobile = rows.filter(item => (item.projects || []).includes('mobile-chromium') || item.project === 'mobile-chromium').length;
  const errors = [];
  if (rows.length !== 3) errors.push(`expected 3 selected identities, got ${rows.length}`);
  if (desktop !== 0) errors.push(`expected 0 chromium identities, got ${desktop}`);
  if (mobile !== 3) errors.push(`expected 3 mobile-chromium identities, got ${mobile}`);
  if (rows.some(item => excludedPassingTitles.has(item.leafTitle || item.exactTestTitle || item.title))) errors.push('a passing Schedule warning/runtime test was selected');
  const badProjects = rows.filter(item => !['chromium', 'mobile-chromium'].includes(item.project || (item.projects || [])[0] || ''));
  if (badProjects.length) errors.push(`unexpected projects selected: ${[...new Set(badProjects.map(item => item.project || (item.projects || [])[0] || 'unknown'))].join(', ')}`);
  if (errors.length) throw new Error(`reported-failed-only selection must be exactly the 3 current failed identities from the uploaded report: ${errors.join('; ')}`);
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
    ? 'reported-failed-only runs only the 3 current failed identities from the uploaded slim report.'
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
