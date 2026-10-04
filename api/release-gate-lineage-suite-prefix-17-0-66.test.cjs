
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  qualifyManifestSelectionsWithCurrentInventory,
  resolveSelectionRowsAgainstInventory,
} = require('../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

const specPath = '86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs';
const windowsSpecPath = '86chaos-release-gate\\56-manager-brief-sticky-day-header.spec.cjs';
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
};

function evidenceSelection(fullSuitePath = `${windowsSpecPath} > ${suite}`) {
  return {
    specPath,
    title: retiredTitle,
    exactTestTitle: retiredTitle,
    leafTitle: retiredTitle,
    fullSuitePath,
    suitePathParts: fullSuitePath.split(' > '),
    fullTitle: `${fullSuitePath} > ${retiredTitle}`,
    project,
    projects: [project],
    priorStatus: 'failed',
    selectionReasons: ['previous_failure'],
  };
}

test('17.0.66 migrates the exact handoff lineage when Playwright prefixes fullSuitePath with the spec file', () => {
  const qualified = qualifyManifestSelectionsWithCurrentInventory(
    { selected: [evidenceSelection()] },
    { currentRecords: [currentRecord] },
  );
  assert.equal(qualified.totalSelected, 1);
  assert.equal(qualified.legacyIdentityMigration.retiredIdentityCount, 1);
  const [row] = qualified.selected;
  assert.equal(row.exactTestTitle, currentTitle);
  assert.equal(row.fullSuitePath, suite);
  assert.equal(row.project, project);
  assert.equal(row.migratedFromRetiredIdentity, true);
  assert.ok(row.selectionReasons.includes('previous_failure'));
  assert.ok(row.selectionReasons.includes('retired_identity_migration'));
});

test('17.0.66 only strips the matching spec-file prefix and still fails closed for a mismatched suite lineage', () => {
  const unrelatedPrefix = '86chaos-release-gate\\99-unrelated.spec.cjs';
  const input = evidenceSelection(`${unrelatedPrefix} > ${suite}`);
  const [resolved] = resolveSelectionRowsAgainstInventory(input, {}, {
    byKey: new Map(),
    byLooseKey: new Map(),
    records: [currentRecord],
  });
  assert.equal(resolved.exactTestTitle, retiredTitle);
  assert.equal(resolved.migratedFromRetiredIdentity, false);
});
