'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test.describe('17.0.79 managed-emulator baseline lineage repair', () => {
  test('failed+new baseline selection accepts only the explicit runtime-equivalent emulator pair', async () => {
    const helper = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
    expect(helper).toContain("'17.0.77|17.0.76'");
    expect(helper).toMatch(/firebaseTarget[^\n]+EMULATOR/);
    expect(helper).toMatch(/firebaseProjectId[^\n]+demo-86chaos/);
    expect(helper).toMatch(/runtime behavior is unchanged/i);
    expect(helper).toMatch(/baselineVersionsAreCompatible/);
    expect(helper).toMatch(/Baseline source\/deployed versions do not match/);
  });
});
