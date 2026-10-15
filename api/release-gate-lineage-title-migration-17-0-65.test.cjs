'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  qualifyManifestSelectionsWithCurrentInventory,
  resolveSelectionRowsAgainstInventory,
} = require('../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

const specPath = '86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs';
const suite = '56 Manager Brief runtime + sticky Schedule Builder day header';
const retiredTitle = 'Schedule Builder day/date header stays below the sticky control deck during vertical scroll';
const currentTitle = 'Schedule Builder day/date header stays pinned while compact control deck scrolls away';
const project = 'mobile-chromium';
const { schedulePartitionFixture, currentTitles, retiredTitle: scheduleRetiredTitle } = require('../tests/fixtures/schedule-phase1-lineage.cjs');

test('Phase 1 failed editing/deletion lineage selects both independent current workflows for the same browser', () => {
  for (const spec of ['e2e/schedule-builder-phase1-19.spec.cjs', '86chaos-release-gate/108-schedule-builder-phase1-19.spec.cjs']) {
    for (const browser of ['chromium', 'mobile-chromium', 'edge-pwa', 'firefox-pwa', 'webkit-pwa', 'mobile-webkit-pwa']) {
      const f = schedulePartitionFixture(spec, browser);
      const qualified = qualifyManifestSelectionsWithCurrentInventory(f.manifest, { currentRecords: f.currentRecords });
      assert.equal(qualified.totalSelected, 2);
      assert.deepEqual(qualified.selected.map(row => row.exactTestTitle).sort(), [...currentTitles].sort());
      for (const row of qualified.selected) {
        assert.equal(row.project, browser); assert.equal(row.priorStatus, 'failed');
        assert.equal(row.migratedFromRetiredIdentity, true);
        assert.equal(row.migrationSourceStableKey, f.manifest.selected[0].stableKey);
        assert.ok(row.selectionReasons.includes('previous_failure'));
      }
    }
  }
});

test('Phase 1 lineage cannot silently omit a partition or substitute another browser', () => {
  const f = schedulePartitionFixture('e2e/schedule-builder-phase1-19.spec.cjs', 'webkit-pwa');
  for (const records of [f.currentRecords.slice(0, 1), [...f.currentRecords, f.currentRecords[0]], f.currentRecords.map(row => ({ ...row, project: 'chromium' }))]) {
    const qualified = qualifyManifestSelectionsWithCurrentInventory(f.manifest, { currentRecords: records });
    assert.equal(qualified.totalSelected, 1);
    assert.equal(qualified.selected[0].exactTestTitle, scheduleRetiredTitle);
    assert.equal(qualified.selected[0].migratedFromRetiredIdentity, false);
  }
});
const currentRecord = {
  specPath,
  exactTestTitle: currentTitle,
  title: currentTitle,
  leafTitle: currentTitle,
  fullSuitePath: suite,
  suitePathParts: [suite],
  titlePathParts: [suite, currentTitle],
  fullTitle: `${suite} > ${currentTitle}`,
  project,
  stableKey: `${specPath}\u0000${suite}\u0000${currentTitle}\u0000${project}`,
  sourceFileHash: 'current-56-hash',
};

function retiredSelection(title = retiredTitle) {
  return {
    specPath,
    title,
    exactTestTitle: title,
    leafTitle: title,
    fullSuitePath: suite,
    fullTitle: `${suite} > ${title}`,
    project,
    projects: [project],
    priorStatus: 'failed',
    selectionReasons: ['previous_failure'],
    stableKey: `${specPath}\u0000${suite}\u0000${title}\u0000${project}`,
  };
}

test('17.0.65 failed+new migrates the retired sticky-header title to the current mobile identity', () => {
  const qualified = qualifyManifestSelectionsWithCurrentInventory({ selected: [retiredSelection()] }, { currentRecords: [currentRecord] });
  assert.equal(qualified.totalSelected, 1);
  assert.equal(qualified.legacyIdentityMigration.retiredIdentityCount, 1);
  const [row] = qualified.selected;
  assert.equal(row.exactTestTitle, currentTitle);
  assert.equal(row.fullSuitePath, suite);
  assert.equal(row.project, project);
  assert.equal(row.migratedFromRetiredIdentity, true);
  assert.ok(row.selectionReasons.includes('previous_failure'));
  assert.ok(row.selectionReasons.includes('retired_identity_migration'));
  assert.equal(row.migrationSourceStableKey, retiredSelection().stableKey);
});

test('17.0.65 retired-title migration remains exact and does not mask unrelated missing Playwright identities', () => {
  const unknown = retiredSelection('Schedule Builder totally unrelated retired title');
  const [resolved] = resolveSelectionRowsAgainstInventory(unknown, {}, {
    byKey: new Map(),
    byLooseKey: new Map(),
    records: [currentRecord],
  });
  assert.equal(resolved.exactTestTitle, unknown.exactTestTitle);
  assert.notEqual(resolved.exactTestTitle, currentTitle);
  assert.equal(resolved.migratedFromRetiredIdentity, false);
});
