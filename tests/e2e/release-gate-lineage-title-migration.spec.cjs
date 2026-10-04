'use strict';
const { test, expect } = require('@playwright/test');
const {
  qualifyManifestSelectionsWithCurrentInventory,
} = require('../../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

test('failed+new keeps a failed mobile sticky-header lineage after its 17.0.64 behavior-title rename', async () => {
  const specPath = '86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs';
  const suite = '56 Manager Brief runtime + sticky Schedule Builder day header';
  const retired = 'Schedule Builder day/date header stays below the sticky control deck during vertical scroll';
  const current = 'Schedule Builder day/date header stays pinned while compact control deck scrolls away';
  const project = 'mobile-chromium';
  const qualified = qualifyManifestSelectionsWithCurrentInventory({
    selected: [{ specPath, title: retired, exactTestTitle: retired, fullSuitePath: suite, project, projects: [project], priorStatus: 'failed' }],
  }, {
    currentRecords: [{
      specPath,
      title: current,
      exactTestTitle: current,
      leafTitle: current,
      fullSuitePath: suite,
      fullTitle: `${suite} > ${current}`,
      suitePathParts: [suite],
      titlePathParts: [suite, current],
      project,
      stableKey: `${specPath}\u0000${suite}\u0000${current}\u0000${project}`,
    }],
  });
  expect(qualified.selected).toHaveLength(1);
  expect(qualified.selected[0]).toMatchObject({ exactTestTitle: current, project, priorStatus: 'failed', migratedFromRetiredIdentity: true });
});

test('failed+new accepts the real Playwright lineage shape with a Windows spec-file suite prefix', async () => {
  const specPath = '86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs';
  const windowsSpecPath = '86chaos-release-gate\\56-manager-brief-sticky-day-header.spec.cjs';
  const suite = '56 Manager Brief runtime + sticky Schedule Builder day header';
  const retired = 'Schedule Builder day/date header stays below the sticky control deck during vertical scroll';
  const current = 'Schedule Builder day/date header stays pinned while compact control deck scrolls away';
  const project = 'mobile-chromium';
  const legacySuite = `${windowsSpecPath} > ${suite}`;
  const qualified = qualifyManifestSelectionsWithCurrentInventory({
    selected: [{ specPath, title: retired, exactTestTitle: retired, fullSuitePath: legacySuite, fullTitle: `${legacySuite} > ${retired}`, project, projects: [project], priorStatus: 'failed' }],
  }, {
    currentRecords: [{
      specPath,
      title: current,
      exactTestTitle: current,
      leafTitle: current,
      fullSuitePath: suite,
      fullTitle: `${suite} > ${current}`,
      suitePathParts: [suite],
      titlePathParts: [suite, current],
      project,
      stableKey: `${specPath}\u0000${suite}\u0000${current}\u0000${project}`,
    }],
  });
  expect(qualified.selected).toHaveLength(1);
  expect(qualified.selected[0]).toMatchObject({ exactTestTitle: current, fullSuitePath: suite, project, priorStatus: 'failed', migratedFromRetiredIdentity: true });
});

