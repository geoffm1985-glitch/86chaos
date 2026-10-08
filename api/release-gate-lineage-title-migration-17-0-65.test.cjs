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
