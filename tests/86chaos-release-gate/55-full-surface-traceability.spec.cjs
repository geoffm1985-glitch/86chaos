const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROUTE_SPECS, attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { ROUTE_STATES } = require('./exhaustive-surface-matrix.cjs');
const WORKFLOWS = require('./mutation-workflow-manifest.cjs');
const { APP_ROUTE_IDS } = require('../../scripts/86chaos-release-gate/route-access-matrix.cjs');
const { RELEASE_CRITICAL_SPECS, specIsInReleaseUniverse } = require('../../scripts/86chaos-release-gate/release-test-universe.cjs');

const ROOT = process.cwd();
const traceabilityPath = path.join(ROOT, 'test-tools/certification/release-gate-traceability-17-0-40.json');

test.describe('55 full-app Release Gate traceability audit', () => {
  test('every automatable inventory layer is explicitly mapped and no mapped test is missing from the Release Gate universe', async ({}, testInfo) => {
    const matrix = JSON.parse(fs.readFileSync(traceabilityPath, 'utf8'));
    const mappedTests = [...new Set(matrix.coverageLayers.flatMap(layer => layer.tests || []))];
    const missingFiles = mappedTests.filter(rel => !fs.existsSync(path.join(ROOT, rel)));
    const browserSpecsOutsideUniverse = mappedTests.filter(rel => /\.spec\.cjs$/.test(rel) && !specIsInReleaseUniverse(rel));
    const canonicalRoutes = [...APP_ROUTE_IDS].sort();
    const routeSpecs = ROUTE_SPECS.map(row => row.tab).sort();
    const routesMissingNestedInventory = canonicalRoutes.filter(route => !Object.prototype.hasOwnProperty.call(ROUTE_STATES, route));
    const workflowRowsMissingEvidence = WORKFLOWS.filter(row => !row.testFile || !(row.actionIds || []).length || !fs.existsSync(path.join(ROOT, row.testFile)));
    const manualOnlyWithoutReason = (matrix.manualOnly || []).filter(row => !String(row.behavior || '').trim() || !String(row.reason || '').trim());
    const emergencyCritical = [
      'tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs',
      'tests/86chaos-release-gate/54-emergency-schedule-requestoff.spec.cjs',
      'tests/86chaos-release-gate/55-full-surface-traceability.spec.cjs'
    ];
    const emergencyMissing = emergencyCritical.filter(rel => !fs.existsSync(path.join(ROOT, rel)));

    const report = {
      release: matrix.release,
      coverageLayerCount: matrix.coverageLayers.length,
      mappedTestCount: mappedTests.length,
      missingFiles,
      browserSpecsOutsideUniverse,
      canonicalRoutes,
      routeSpecs,
      routesMissingNestedInventory,
      workflowCount: WORKFLOWS.length,
      workflowRowsMissingEvidence: workflowRowsMissingEvidence.map(row => ({ name: row.name, testFile: row.testFile, actionIds: row.actionIds })),
      manualOnly: matrix.manualOnly,
      manualOnlyWithoutReason,
      emergencyMissing,
      releaseCriticalCount: RELEASE_CRITICAL_SPECS.length
    };
    await attachJson(testInfo, '55-full-surface-traceability.json', report);

    expect(matrix.release).toBe('17.0.40');
    expect(matrix.coverageLayers.length, 'Coverage audit must retain broad automated layers instead of a narrow emergency-only suite').toBeGreaterThanOrEqual(15);
    expect(missingFiles, 'Every traceability entry must point to a real automated test/runner').toEqual([]);
    expect(browserSpecsOutsideUniverse, 'Every mapped browser spec must be reachable by the full Play Store / Release Gate universe').toEqual([]);
    expect(routeSpecs, 'Every canonical route must remain inventoried by the browser route matrix').toEqual(canonicalRoutes);
    expect(routesMissingNestedInventory, 'Every route must declare nested-state inventory, even when the list is intentionally empty').toEqual([]);
    expect(workflowRowsMissingEvidence, 'Every declared mutation workflow must name action IDs and a real browser evidence target').toEqual([]);
    expect(manualOnlyWithoutReason, 'Every non-automated behavior must carry a concrete manual-only justification').toEqual([]);
    expect(emergencyMissing).toEqual([]);
  });
});
