'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cjsDiagnostics = require('../src/core/firebaseCostDiagnostics.cjs');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('17.0.52 System Administrator uses browser-native Firebase cost diagnostics instead of CommonJS browser interop', () => {
  const management = read('src/features/management.jsx');
  const browserModule = read('src/core/firebaseCostDiagnostics.js');
  assert.match(management, /import \{ buildFirebaseCostDiagnostics \} from ['"]\.\.\/core\/firebaseCostDiagnostics\.js['"]/);
  assert.doesNotMatch(management, /firebaseCostDiagnostics\.cjs/);
  assert.doesNotMatch(management, /firebaseCostDiagnosticsHelpers/);
  assert.match(browserModule, /function buildFirebaseCostDiagnostics\(/);
  assert.match(browserModule, /export \{ buildFirebaseCostDiagnostics \};/);
  assert.doesNotMatch(browserModule, /module\.exports/);
  assert.match(management, /useMemo\(\(\) => buildFirebaseCostDiagnostics\(getFirebaseUsageDiagnostics\?\.\(\) \|\| \{\}, \{ rtdbKnown:false \}\)/);
});

test('17.0.52 browser and Node Firebase cost diagnostics preserve the same calculation contract', () => {
  assert.equal(typeof cjsDiagnostics.buildFirebaseCostDiagnostics, 'function');
  const report = cjsDiagnostics.buildFirebaseCostDiagnostics({
    activeListeners: 1,
    writesInitiated: 3,
    writesCompleted: 2,
    skippedNoOpWrites: 1,
    listeners: {
      inventory: { collection: 'inventoryItems', subscriberCount: 1, consumerLabels: ['inventory'], listenerCreationCount: 1, documentsReceivedInitial: 12 }
    }
  }, { rtdbKnown: false });
  assert.equal(report.firestore.activeListeners, 1);
  assert.equal(report.firestore.documentsObserved, 12);
  assert.equal(report.firestore.writesCompleted, 2);
  assert.equal(report.firestore.skippedNoOpWrites, 1);
  assert.equal(report.rtdb.status, 'unknown');
  assert.deepEqual(report.findings.duplicateListeners, []);
  assert.deepEqual(report.findings.abandonedListeners, []);
});

test('17.0.52 release gate and Playwright inventory permanently cover the exact System Administrator runtime failure', () => {
  const universe = read('scripts/86chaos-release-gate/release-test-universe.cjs');
  const workflow = read('.github/workflows/testing-targeted-delta.yml');
  const browser = read('tests/86chaos-release-gate/65-system-admin-firebase-cost-runtime-17-0-52.spec.cjs');
  assert.match(universe, /65-system-admin-firebase-cost-runtime-17-0-52\.spec\.cjs/);
  assert.match(workflow, /65-system-admin-firebase-cost-runtime-17-0-52\.spec\.cjs/);
  assert.match(browser, /firebase-cost-observability/);
  assert.match(browser, /ut is not a function/);
  assert.match(browser, /not a function/);
  assert.match(browser, /gotoTab\(page, 'godmode'/);
});
