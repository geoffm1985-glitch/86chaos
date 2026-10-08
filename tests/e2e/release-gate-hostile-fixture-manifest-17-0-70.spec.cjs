'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test.describe('17.0.70 independent hostile fixture manifest regression', () => {
  test('stale historical fixture cannot omit manifest.version again', async () => {
    const source = fs.readFileSync(path.join(root, 'api/release-gate-execution-17-0-5.test.cjs'), 'utf8');
    expect(source).toContain('schemaVersion:2,version:initial.version,sourceHash:initial.sourceHash,files:initial.files');
    expect(source).not.toContain('schemaVersion:1,sourceHash:initial.sourceHash,files:initial.files');
  });

  test('17.0.70 regression is wired into mandatory release discovery', async () => {
    const universe = require('../../scripts/86chaos-release-gate/release-test-universe.cjs');
    expect(universe.RELEASE_CRITICAL_SPECS).toContain('tests/86chaos-release-gate/82-release-gate-hostile-fixture-manifest-17-0-70.spec.cjs');
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/testing-targeted-delta.yml'), 'utf8');
    expect(workflow).toContain('tests/86chaos-release-gate/82-release-gate-hostile-fixture-manifest-17-0-70.spec.cjs');
    expect(workflow).toContain('tests/e2e/release-gate-hostile-fixture-manifest-17-0-70.spec.cjs');
  });
});
