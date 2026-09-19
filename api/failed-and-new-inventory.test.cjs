'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePlaywrightListOutput, projectsForSpec } = require('../scripts/86chaos-release-gate/playwright-inventory.cjs');

test('Playwright inventory v3 extracts exact discovered titles and PWA project combinations', () => {
  const output = [
    '[chromium] › tests/86chaos-full-audit/01-auth-route-health.spec.cjs:10:3 › route health › alpha exact title',
    '[edge-pwa] › tests/86chaos-release-gate/27-pwa-browser-icon-matrix.spec.cjs:20:3 › pwa metadata › Edge icon metadata loads'
  ].join('\n');
  const records = parsePlaywrightListOutput(output, process.cwd());
  assert.equal(records.length, 2);
  assert.ok(records.some(r => r.leafTitle === 'alpha exact title' && r.fullSuitePath === 'route health'));
  assert.ok(records.some(r => r.project === 'edge-pwa' && r.leafTitle === 'Edge icon metadata loads'));
  assert.ok(projectsForSpec('86chaos-release-gate/27-pwa-browser-icon-matrix.spec.cjs').includes('edge-pwa'));
  assert.ok(projectsForSpec('86chaos-full-audit/01-auth-route-health.spec.cjs').includes('mobile-chromium'));
});

const { qualifyManifestSelectionsWithCurrentInventory, validateManifestTestIdentities } = require('../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

test('failed+new migrates legacy ambiguous leaf-title selections into exact schema-v3 identities', () => {
  const currentRecords = ['system-admin', 'owner', 'manager', 'staff'].map(role => ({
    specPath: 'e2e/authenticated-release.spec.cjs',
    fullSuitePath: `${role} authenticated release surfaces`,
    suitePathParts: [`${role} authenticated release surfaces`],
    leafTitle: 'opens every permitted primary surface without runtime or layout failure',
    exactTestTitle: 'opens every permitted primary surface without runtime or layout failure',
    title: 'opens every permitted primary surface without runtime or layout failure',
    fullTitle: `${role} authenticated release surfaces > opens every permitted primary surface without runtime or layout failure`,
    titlePathParts: [`${role} authenticated release surfaces`, 'opens every permitted primary surface without runtime or layout failure'],
    project: 'chromium',
    sourceFileHash: `hash-${role}`,
    stableKey: `e2e/authenticated-release.spec.cjs\u0000${role} authenticated release surfaces\u0000opens every permitted primary surface without runtime or layout failure\u0000chromium`,
  }));
  const manifest = {
    selected: [{
      specPath: 'e2e/authenticated-release.spec.cjs',
      title: 'opens every permitted primary surface without runtime or layout failure',
      exactTestTitle: 'opens every permitted primary surface without runtime or layout failure',
      project: 'chromium',
      projects: ['chromium'],
      priorStatus: 'failed',
      stableKey: 'legacy-v2-loose-key-system-admin',
    }],
  };
  const qualified = qualifyManifestSelectionsWithCurrentInventory(manifest, { currentRecords });
  assert.equal(qualified.totalSelected, 4);
  assert.equal(qualified.legacyIdentityMigration.expandedAmbiguousCount, 4);
  assert.deepEqual(qualified.selected.map(row => row.fullSuitePath).sort(), [
    'manager authenticated release surfaces',
    'owner authenticated release surfaces',
    'staff authenticated release surfaces',
    'system-admin authenticated release surfaces',
  ]);
  assert.equal(new Set(qualified.selected.map(row => row.stableKey)).size, 4);
});
