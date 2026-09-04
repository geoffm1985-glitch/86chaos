'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

const requiredUltimateFiles = [
  'test-tools/ultimate-source-inventory.cjs',
  'tests/86chaos-full-audit/13-back-office-document-vault.spec.cjs',
  'tests/86chaos-release-gate/28-exhaustive-route-state-control-graph.spec.cjs',
  'tests/86chaos-release-gate/29-source-exhaustiveness-ledger.spec.cjs',
  'tests/86chaos-release-gate/30-exhaustive-role-route-permission-matrix.spec.cjs',
  'tests/86chaos-release-gate/31-exhaustive-responsive-nested-layout.spec.cjs',
  'tests/86chaos-release-gate/32-exhaustive-nested-accessibility.spec.cjs',
  'tests/86chaos-release-gate/33-business-math-exhaustiveness.spec.cjs',
  'tests/86chaos-release-gate/34-ultimate-test-universe-integrity.spec.cjs',
  'tests/86chaos-release-gate/exhaustive-surface-matrix.cjs',
  'tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs',
];

test('Ultimate Play Store test universe required by the failed baseline is present', () => {
  for (const file of requiredUltimateFiles) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} must be present`);
  }
});

test('bundled 20260822-173450 failed-only fallback is exactly 14 FAIL + 2 TIMEOUT identities', () => {
  const manifest = json('scripts/86chaos-release-gate/reported-failed-only-20260822-173450.json');
  assert.equal(manifest.mode, 'failed-only');
  assert.equal(manifest.baselineFullRunId, '2026-08-21T22-49-42');
  assert.equal(manifest.baselineSourceVersion, '16.0.191');
  assert.equal(manifest.baselineDeployedVersion, '16.0.191');
  assert.equal(manifest.selected.length, 16);
  assert.equal(manifest.totalSelected, 16);
  assert.equal(manifest.desktopSelected, 9);
  assert.equal(manifest.mobileSelected, 7);
  assert.equal(manifest.selected.filter(row => row.priorStatus === 'failed').length, 14);
  assert.equal(manifest.selected.filter(row => row.priorStatus === 'timedOut').length, 2);
  assert.equal(manifest.selected.some(row => ['passed', 'skipped', 'notrun', 'not-run', 'not_run'].includes(String(row.priorStatus || '').toLowerCase())), false);
  const keys = manifest.selected.map(row => row.stableKey);
  assert.equal(new Set(keys).size, 16, 'failed-only fallback must contain no duplicate stable identities');
});

test('all 16 fallback identities still resolve against the restored current test universe', () => {
  const manifest = json('scripts/86chaos-release-gate/reported-failed-only-20260822-173450.json');
  const {
    currentInventoryRecords,
    qualifyManifestSelectionsWithCurrentInventory,
  } = require('../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

  const currentRecords = currentInventoryRecords(root, { allowStaticFallback: true });
  const qualified = qualifyManifestSelectionsWithCurrentInventory(manifest, {
    root,
    currentRecords,
    allowStaticFallback: true,
  });

  const responsiveMigration = qualified.selected.filter(row => row.migratedFromLegacyResponsiveMatrix);
  const expectedResponsiveExecutions = responsiveMigration.length || 1;
  assert.ok(expectedResponsiveExecutions === 1 || expectedResponsiveExecutions === 5, 'legacy responsive identity must remain intact or expand to all five viewport shards');
  assert.equal(qualified.totalSelected, 15 + expectedResponsiveExecutions);
  assert.equal(qualified.desktopSelected, 8 + expectedResponsiveExecutions);
  assert.equal(qualified.mobileSelected, 7);
  assert.equal(qualified.selected.filter(row => row.priorStatus === 'failed').length, 13 + expectedResponsiveExecutions);
  assert.equal(qualified.selected.filter(row => row.priorStatus === 'timedOut').length, 2);

  if (responsiveMigration.length) {
    const viewportNames = responsiveMigration.map(row => row.leafTitle.match(/\[([^\]]+)\]$/)?.[1]).sort();
    assert.deepEqual(viewportNames, ['desktop', 'laptop', 'narrow-phone', 'phone', 'tablet']);
  }

  for (const row of qualified.selected) {
    const spec = path.join(root, 'tests', row.specPath);
    assert.equal(fs.existsSync(spec), true, `${row.project} ${row.specPath} must exist`);
    const source = fs.readFileSync(spec, 'utf8');
    const retainedTitle = row.migratedFromLegacyResponsiveMatrix
      ? row.leafTitle.replace(/\s+\[[^\]]+\]$/, '')
      : row.leafTitle;
    assert.match(source, new RegExp(retainedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${row.specPath} must retain failed leaf title`);
  }
});

test('failed-only preparation can use static identity validation and bundled baseline when local history is gone', () => {
  const prepare = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
  const utils = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
  assert.match(prepare, /currentInventoryRecords\(process\.cwd\(\), \{ allowStaticFallback: selectionMode === 'failed-only' \}\)/);
  assert.match(prepare, /reported-failed-only-20260822-173450\.json/);
  assert.match(prepare, /bundled-uploaded-full-release-gate-20260822-173450-fail-timeout-only|bundled-latest-failed-only-20260823-183916-fail-only/);
  assert.match(prepare, /allowStaticFallback: selectionMode === 'failed-only'/);
  assert.match(utils, /baselineMode === 'bundled-full-baseline-fallback'/);
});

test('focused failed-only Playwright config does not rediscover the entire universe before execution', () => {
  const config = read('playwright.failed-release.config.cjs');
  assert.doesNotMatch(config, /generatePlaywrightInventory/);
  assert.match(config, /discoveryMode: 'failed-only-manifest-selection'/);
  assert.match(config, /records: FAILED_ONLY_TESTS/);
  assert.match(config, /Failed-only manifest selected zero tests\. Refusing to run a false-green diagnostic gate/);
});
