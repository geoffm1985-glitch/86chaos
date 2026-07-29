const fs = require('fs');
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const { ensureRunDir, getFailedOnlyManifestPath } = require('./scripts/86chaos-release-gate/run-context.cjs');
const { FAILED_ONLY_TESTS, specsFromManifest } = require('./tests/86chaos-release-gate/failed-only-manifest.cjs');

const { runDir, runId } = ensureRunDir();
const baseURL = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
const resultsRoot = path.join(runDir, 'failed-only');
fs.mkdirSync(resultsRoot, { recursive: true });

function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function grepForProject(projectName) {
  const titles = [...new Set(FAILED_ONLY_TESTS.filter(item => item.projects.includes(projectName)).map(item => item.title))];
  if (!titles.length) return /$a/;
  return new RegExp(titles.map(title => `(?:^|.* > )${escapeRegExp(title)}$`).join('|'));
}

const manifest = {
  ok: FAILED_ONLY_TESTS.length > 0,
  generatedAt: new Date().toISOString(),
  runId,
  runDir,
  mode: 'failed-only',
  selected: FAILED_ONLY_TESTS,
  desktopSelected: FAILED_ONLY_TESTS.filter(item => item.projects.includes('chromium')).length,
  mobileSelected: FAILED_ONLY_TESTS.filter(item => item.projects.includes('mobile-chromium')).length,
};
fs.writeFileSync(getFailedOnlyManifestPath(runId), JSON.stringify(manifest, null, 2));
if (!FAILED_ONLY_TESTS.length) throw new Error('Failed-only manifest selected zero tests. Refusing to run a false-green diagnostic gate.');
console.log('86 Chaos failed-only selected tests:');
for (const item of FAILED_ONLY_TESTS) console.log(`- [${item.projects.join(', ')}] ${item.spec} :: ${item.title}`);
console.log(`Desktop tests selected: ${manifest.desktopSelected}`);
console.log(`Mobile tests selected: ${manifest.mobileSelected}`);
console.log(`Failed-only run directory: ${resultsRoot}`);

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
    ['list'],
    ['json', { outputFile: path.join(runDir, 'playwright-report.json') }],
    ['html', { outputFolder: path.join(resultsRoot, 'html-report'), open: 'never' }]
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', grep: grepForProject('chromium'), use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', grep: grepForProject('mobile-chromium'), use: { ...devices['Pixel 5'] } }
  ]
});
