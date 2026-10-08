
'use strict';
const { test, expect } = require('@playwright/test');
const {
  qualifyManifestSelectionsWithCurrentInventory,
} = require('../../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

const specPath = '86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs';
const windowsSpecPath = '86chaos-release-gate\\56-manager-brief-sticky-day-header.spec.cjs';
const suite = '56 Manager Brief runtime + sticky Schedule Builder day header';
const retiredTitle = 'Schedule Builder day/date header stays below the sticky control deck during vertical scroll';
const currentTitle = 'Schedule Builder day/date header stays pinned while compact control deck scrolls away';
const project = 'mobile-chromium';

test.describe('17.0.66 failed+new suite-prefix lineage repair', () => {
  test('the exact Yardmaster failed lineage resolves to the current mobile sticky-header identity', async () => {
    const legacySuite = `${windowsSpecPath} > ${suite}`;
    const qualified = qualifyManifestSelectionsWithCurrentInventory({
      selected: [{
        specPath,
        title: retiredTitle,
        exactTestTitle: retiredTitle,
        leafTitle: retiredTitle,
        fullSuitePath: legacySuite,
        suitePathParts: legacySuite.split(' > '),
        fullTitle: `${legacySuite} > ${retiredTitle}`,
        project,
        projects: [project],
        priorStatus: 'failed',
        selectionReasons: ['previous_failure'],
      }],
    }, {
      currentRecords: [{
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
      }],
    });

    expect(qualified.totalSelected).toBe(1);
    expect(qualified.legacyIdentityMigration.retiredIdentityCount).toBe(1);
    expect(qualified.selected[0]).toMatchObject({
      exactTestTitle: currentTitle,
      fullSuitePath: suite,
      project,
      priorStatus: 'failed',
      migratedFromRetiredIdentity: true,
    });
    expect(qualified.selected[0].selectionReasons).toContain('retired_identity_migration');
  });
});
