'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test.describe('17.0.84 independent owned full-gate fidelity regression', () => {
  test('release discovery and targeted delta keep the 17.0.84 regression mandatory', async () => {
    const universe = require('../../scripts/86chaos-release-gate/release-test-universe.cjs');
    expect(universe.RELEASE_CRITICAL_SPECS).toContain('tests/86chaos-release-gate/96-owned-full-fidelity-17-0-84.spec.cjs');
    const workflow = read('.github/workflows/testing-targeted-delta.yml');
    expect(workflow).toContain('tests/86chaos-release-gate/96-owned-full-fidelity-17-0-84.spec.cjs');
    expect(workflow).toContain('tests/e2e/owned-full-fidelity-17-0-84.spec.cjs');
  });

  test('all four captured 17.0.83 failure modes stay pinned to their narrow harness repairs', async () => {
    const profile = read('tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs');
    const exportSpec = read('tests/86chaos-full-audit/14-export-import-regression-graveyard.spec.cjs');
    const chunk = read('tests/86chaos-release-gate/17-resilience-chunk-offline.spec.cjs');
    const coverage = read('tests/86chaos-release-gate/21-runtime-code-coverage.spec.cjs');
    expect(profile).toMatch(/timeOffPolicy:\s*\{\s*enabled:\s*false,/);
    expect(exportSpec).toContain('let authRecoveries = 0');
    expect(chunk).toContain('recoveredHealthyApp || usableRecoveryUi');
    expect(coverage).toContain('Verified System Administrator must actually enter godmode before runtime coverage is scored');
  });
});
