'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

test('16.0.194 bundles the latest failed-only 10-identity fallback and excludes the 6 already-passed focused identities', () => {
  const manifest = json('scripts/86chaos-release-gate/reported-failed-only-20260823-183916.json');
  assert.equal(manifest.mode, 'failed-only');
  assert.equal(manifest.previousFailedOnlyRunId, '2026-08-22T14-40-29');
  assert.equal(manifest.previousFailedOnlySourceVersion, '16.0.193');
  assert.equal(manifest.totalSelected, 10);
  assert.equal(manifest.desktopSelected, 6);
  assert.equal(manifest.mobileSelected, 4);
  assert.equal(manifest.selected.length, 10);
  assert.equal(manifest.selected.filter(row => row.priorStatus === 'failed').length, 10);
  assert.equal(manifest.selected.some(row => ['passed', 'skipped', 'timedOut', 'timeout', 'notrun', 'not-run', 'not_run'].includes(String(row.priorStatus || ''))), false);
  const keys = manifest.selected.map(row => row.stableKey);
  assert.equal(new Set(keys).size, 10, 'latest failed-only fallback must contain no duplicate stable identities');
  const titles = manifest.selected.map(row => `${row.project} ${row.specPath} ${row.leafTitle}`).join('\n');
  assert.doesNotMatch(titles, /04-schedule-math-oracle/);
  assert.doesNotMatch(titles, /18-api-contract-release-gate/);
  assert.doesNotMatch(titles, /21-runtime-code-coverage/);
  assert.doesNotMatch(titles, /mobile-chromium e2e\/schedule-request-off-management\.spec\.cjs/);
});

test('failed-only preparer can fall back to the latest 10 failed identities when local runner history is absent', () => {
  const prepare = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
  assert.match(prepare, /loadBundledLatestFailedOnlyFallback/);
  assert.match(prepare, /reported-failed-only-20260823-183916\.json/);
  assert.match(prepare, /bundled-latest-failed-only-20260823-183916-fail-only/);
  assert.match(prepare, /counts\.total !== 10/);
  assert.match(prepare, /failures !== 10 \|\| timeouts !== 0/);
  const utils = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
  assert.match(utils, /isBundledFocusedFallback/);
  assert.match(utils, /Bundled focused fallback selected zero failed tests/);
});

test('focused failed-only Playwright config still derives execution strictly from the manifest selection', () => {
  const config = read('playwright.failed-release.config.cjs');
  assert.doesNotMatch(config, /generatePlaywrightInventory/);
  assert.match(config, /discoveryMode: 'failed-only-manifest-selection'/);
  assert.match(config, /testMatch: specsFromManifest\(FAILED_ONLY_TESTS\)/);
  assert.match(config, /grep: grepForProject\(FAILED_ONLY_TESTS, 'chromium'\)/);
  assert.match(config, /grep: grepForProject\(FAILED_ONLY_TESTS, 'mobile-chromium'\)/);
});

test('16.0.194 harness fixes address the exact second-layer failures without changing failed test identities', () => {
  const vault = read('tests/86chaos-full-audit/13-back-office-document-vault.spec.cjs');
  const helper = read('tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');
  const matrix = read('scripts/86chaos-release-gate/route-access-matrix.cjs');
  const requestOff = read('tests/e2e/schedule-request-off-management.spec.cjs');
  assert.match(vault, /finish attaching its file before the test refreshes the page/);
  assert.equal(vault.includes('toHaveText(/Preview \\/ Download/i, { timeout:45000 })'), true);
  assert.match(helper, /stateLabelAlreadyVisible/);
  assert.match(helper, /navigation-control-visible-descriptor-proven/);
  assert.match(helper, /safe-control-actionability-deferred-after-dom-change/);
  assert.match(matrix, /staff:\s*\[[^\]]*'settings'[^\]]*\]/s);
  assert.match(requestOff, /Schedule Builder must hydrate seeded QA staff before warning assertions run/);
  assert.match(requestOff, /Allen QA\|Chuck QA\|Lani QA/);
  assert.match(vault, /test\('upload, persistence, download\/preview, replace, path guard, delete, and cleanup all work in disposable QA'/);
  assert.match(requestOff, /test\('Schedule Builder requested-off warning shows employee name and never Someone'/);
});
