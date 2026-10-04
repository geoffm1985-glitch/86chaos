const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test('17.0.80 keeps failure-lineage reuse narrower than certification compatibility', async () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'scripts/86chaos-release-gate/failed-only-manifest-utils.cjs'), 'utf8');
  expect(source).toContain("`${sourceVersion}|${deployedVersion}` !== '17.0.77|17.0.76'");
  expect(source).toContain("lineageMode: failureLineageOnly ? 'full-failure-lineage' : 'full-baseline'");
  expect(source).toMatch(/completed\?\.ok && total > 0 && unexpected > 0/);
  expect(source).toMatch(/baselineVersionsAreCompatible\(meta\) \|\| isExplicitCompletedFailureLineage\(meta, completed\)/);
});
