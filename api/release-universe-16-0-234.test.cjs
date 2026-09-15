'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { RELEASE_TEST_MATCH, specIsInReleaseUniverse } = require('../scripts/86chaos-release-gate/release-test-universe.cjs');

test('16.0.234 new-implementation directory is permanently in the full release universe', () => {
  assert.ok(RELEASE_TEST_MATCH.includes('86chaos-new-implementations/**/*.spec.cjs'));
  for (const name of ['01-shift4-connection.spec.cjs','02-shift4-import-review-export.spec.cjs','03-shift4-security-boundary.spec.cjs','04-schedule-pdf-print.spec.cjs']) {
    const relative = `tests/86chaos-new-implementations/${name}`;
    assert.equal(specIsInReleaseUniverse(relative), true, relative);
    assert.equal(fs.existsSync(path.join(process.cwd(), relative)), true, relative);
  }
});

test('machine-readable implementation-to-test matrix covers every new route and PDF helper', () => {
  const matrix = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs/16.0.234-implementation-test-matrix.json'), 'utf8'));
  const implementation = matrix.coverage.map(row => row.implementation).join('\n');
  for (const required of ['shift4-connect.js','shift4-callback.js','shift4-status.js','shift4-test.js','shift4-locations.js','shift4-select-location.js','shift4-sync.js','shift4-records.js','shift4-export.js','schedulePrintModel.js','schedulePdf.js']) assert.match(implementation, new RegExp(required.replace('.', '\\.')));
  assert.equal(matrix.coverage.every(row => Array.isArray(row.tests) && row.tests.length > 0), true);
});
