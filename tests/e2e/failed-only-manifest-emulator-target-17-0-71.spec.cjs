'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test.describe('17.0.71 independent failed-only manifest target regression', () => {
  test('historical baseline evidence remains live-project evidence while current validation is runtime-target aware', async () => {
    const source = fs.readFileSync(path.join(root, 'api/failed-only-manifest-cross-version.test.cjs'), 'utf8');
    expect(source).toMatch(/baseline-run'[\s\S]*firebaseProjectId: 'chaos-test-d1601'/);
    expect(source).toMatch(/currentSourceVersion: '16\.0\.135'[\s\S]*firebaseProjectId: expectedFirebaseProject\(process\.env\)/);
  });

  test('17.0.71 regression is mandatory in release discovery and targeted-delta discovery', async () => {
    const universe = require('../../scripts/86chaos-release-gate/release-test-universe.cjs');
    expect(universe.RELEASE_CRITICAL_SPECS).toContain('tests/86chaos-release-gate/83-failed-only-manifest-emulator-target-17-0-71.spec.cjs');
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/testing-targeted-delta.yml'), 'utf8');
    expect(workflow).toContain('tests/86chaos-release-gate/83-failed-only-manifest-emulator-target-17-0-71.spec.cjs');
    expect(workflow).toContain('tests/e2e/failed-only-manifest-emulator-target-17-0-71.spec.cjs');
  });
});
