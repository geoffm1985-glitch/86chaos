'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { expectedFirebaseProject } = require('../scripts/86chaos-firebase-target.cjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.64 Request Off fixture safety follows LIVE versus EMULATOR target without weakening project checks', () => {
  assert.equal(expectedFirebaseProject({ YARDMASTER_FIREBASE_TARGET: 'emulator' }), 'demo-86chaos');
  assert.equal(expectedFirebaseProject({ YARDMASTER_FIREBASE_TARGET: 'live' }), 'chaos-test-d1601');
  const spec = read('tests/e2e/schedule-request-off-management.spec.cjs');
  assert.match(spec, /expectedFirebaseProject\(process\.env\)/);
  assert.doesNotMatch(spec, /const QA_TEST_PROJECT_ID = ['"]chaos-test-d1601['"]/);
  assert.match(spec, /data\?\.projectId !== QA_TEST_PROJECT_ID/);
});

test('17.0.64 emulator readiness avoids Storage root 501 and keeps Firestore persistence memory-only', () => {
  const target = read('src/core/firebaseTarget.js');
  assert.match(target, /probe\('Storage',[\s\S]*\/v0\/b\//);
  assert.doesNotMatch(target, /probe\('Storage', firebaseEmulatorSettings\.storagePort\),/);
  const core = read('src/core/appCore.js');
  const start = core.indexOf('const enableChaosFirestorePersistence');
  const end = core.indexOf('enableChaosFirestorePersistence();', start);
  const block = core.slice(start, end);
  assert.match(block, /if \(isFirebaseEmulatorTarget\)/);
  assert.ok(block.indexOf('if (isFirebaseEmulatorTarget)') < block.indexOf('enableMultiTabIndexedDbPersistence(db)'), 'emulator bypass must run before IndexedDB persistence');
});

test('17.0.64 compact Schedule Builder and Spanish Preferences regressions preserve current UI invariants', () => {
  const css = read('src/styles.css');
  const mobile = css.match(/@media \(max-width: 767px\) \{[\s\S]*?\.schedule-builder-control-deck \{([\s\S]*?)\s*\}/);
  assert.ok(mobile, 'mobile Schedule Builder control-deck rule must exist');
  assert.match(mobile[1], /position: relative !important/);
  assert.match(mobile[1], /top: auto !important/);
  const sticky = read('tests/86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs');
  assert.match(sticky, /Compact\/mobile control deck must scroll with content/);
  const spanish = read('tests/86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs');
  assert.match(spanish, /openPreferencesAfterHydration/);
  assert.match(spanish, /Preferences must remain active after workspace\/profile hydration settles/);
});
