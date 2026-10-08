'use strict';
const { test, expect } = require('@playwright/test');
const {
  qualifyManifestSelectionsWithCurrentInventory,
} = require('../../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

const specPath = '86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs';
const suite = '56 Manager Brief runtime + sticky Schedule Builder day header';
const retiredTitle = 'Schedule Builder day/date header stays below the sticky control deck during vertical scroll';
const currentTitle = 'Schedule Builder day/date header stays pinned while compact control deck scrolls away';

function record(project) {
  return {
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
}

test.describe('17.0.65 failed+new retired Playwright identity migration', () => {
  test('old mobile sticky-header failure remains selected under the current truthful test title', async () => {
    const project = 'mobile-chromium';
    const manifest = {
      selected: [{
        specPath,
        title: retiredTitle,
        exactTestTitle: retiredTitle,
        leafTitle: retiredTitle,
        fullSuitePath: suite,
        fullTitle: `${suite} > ${retiredTitle}`,
        project,
        projects: [project],
        priorStatus: 'failed',
        selectionReasons: ['previous_failure'],
      }],
    };
    const qualified = qualifyManifestSelectionsWithCurrentInventory(manifest, { currentRecords: [record(project)] });
    expect(qualified.totalSelected).toBe(1);
    expect(qualified.selected[0].exactTestTitle).toBe(currentTitle);
    expect(qualified.selected[0].migratedFromRetiredIdentity).toBe(true);
    expect(qualified.selected[0].selectionReasons).toContain('previous_failure');
    expect(qualified.selected[0].selectionReasons).toContain('retired_identity_migration');
  });
});
