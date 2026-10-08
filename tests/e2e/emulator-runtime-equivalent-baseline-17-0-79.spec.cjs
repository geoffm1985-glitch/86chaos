'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('17.0.79 baseline compatibility remains a narrow emulator-only exception', async () => {
  const helper = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
  const regression = read('api/release-gate-emulator-runtime-equivalent-baseline-17-0-79.test.cjs');
  expect(helper).toMatch(/EXPLICIT_RUNTIME_EQUIVALENT_BASELINE_PAIRS/);
  expect(helper).toMatch(/isLoopbackHttpUrl/);
  expect(regression).toMatch(/mismatched live and unapproved emulator baselines fail-closed/);
  expect(regression).toMatch(/203\.0\.113\.10/);
  expect(regression).toMatch(/firebaseTarget: 'LIVE'/);
});
