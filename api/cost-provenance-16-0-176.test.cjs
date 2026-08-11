'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const costScript = fs.readFileSync(path.join(root, 'scripts/run-cost-regression-tests.js'), 'utf8');
const costSpec = fs.readFileSync(path.join(root, 'tests/e2e/cost-regression.spec.cjs'), 'utf8');
test('cost reports include and validate current-run provenance', () => {
  for (const needle of ['CHAOS_COST_EXPECTED_RUN_ID','CHAOS_COST_EXPECTED_FIREBASE_PROJECT_ID','CHAOS_COST_EXPECTED_VERSION','runId','firebaseProjectId','expectedVersion','before','after']) {
    assert.match(costScript + costSpec, new RegExp(needle));
  }
  assert.match(costScript, /production Firebase/);
  assert.match(costScript, /stale or wrong runId/);
  assert.match(costScript, /FIRESTORE_EMULATOR_HOST is required only for standalone Playwright cost capture mode/);
  assert.match(costSpec, /CHAOS_COST_SCENARIO_REPORT_DIR/);
});
