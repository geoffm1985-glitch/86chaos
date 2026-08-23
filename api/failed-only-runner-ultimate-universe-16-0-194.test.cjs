'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

test('16.0.194 bundled failed-only continuation contains only the 10 remaining failures from 20260823-051244', () => {
  const manifest = json('scripts/86chaos-release-gate/reported-failed-only-20260823-051244.json');
  assert.equal(manifest.mode, 'failed-only');
  assert.equal(manifest.baselineFullRunId, '2026-08-21T22-49-42');
  assert.equal(manifest.previousFailedOnlyRunId, '2026-08-22T14-40-29');
  assert.equal(manifest.previousFailedOnlySourceVersion, '16.0.193');
  assert.equal(manifest.totalSelected, 10);
  assert.equal(manifest.desktopSelected, 6);
  assert.equal(manifest.mobileSelected, 4);
  assert.equal(manifest.previousFailuresSelected, 10);
  assert.equal(manifest.previousTimeoutsSelected, 0);
  assert.equal(manifest.selected.length, 10);
  assert.equal(manifest.selected.every(row => row.priorStatus === 'failed' && row.baselineStatus === 'failed'), true);
  assert.equal(manifest.selected.some(row => ['passed','skipped','timedout','timeout','notrun','not-run','not_run'].includes(String(row.priorStatus || '').toLowerCase())), false);
  assert.equal(new Set(manifest.selected.map(row => row.stableKey)).size, 10);
});

test('all 10 continuation identities resolve against the exact current Ultimate test universe', () => {
  const manifest = json('scripts/86chaos-release-gate/reported-failed-only-20260823-051244.json');
  const { currentInventoryRecords, qualifyManifestSelectionsWithCurrentInventory } = require('../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
  const currentRecords = currentInventoryRecords(root, { allowStaticFallback: true });
  const qualified = qualifyManifestSelectionsWithCurrentInventory(manifest, { root, currentRecords, allowStaticFallback: true });
  assert.equal(qualified.totalSelected, 10);
  assert.equal(qualified.desktopSelected, 6);
  assert.equal(qualified.mobileSelected, 4);
  assert.equal(qualified.selected.every(row => row.priorStatus === 'failed'), true);
  for (const row of qualified.selected) {
    const spec = path.join(root, 'tests', row.specPath);
    assert.equal(fs.existsSync(spec), true, `${row.project} ${row.specPath} must exist`);
    assert.match(fs.readFileSync(spec, 'utf8'), new RegExp(row.leafTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('failed-only fallback preparation now uses the current 10-failure continuation when local history is unavailable', () => {
  const prepare = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
  assert.match(prepare, /reported-failed-only-20260823-051244\.json/);
  assert.match(prepare, /exactly 10 remaining failed identities \(chromium 6, mobile-chromium 4\)/);
  assert.match(prepare, /exactly 10 FAIL and 0 TIMEOUT identities/);
  assert.match(prepare, /bundled-uploaded-failed-only-release-gate-20260823-051244-fail-only/);
  assert.match(prepare, /allowStaticFallback: selectionMode === 'failed-only'/);
});
