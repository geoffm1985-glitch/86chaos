'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'api/failed-only-manifest-cross-version.test.cjs');

function runCrossVersionFixture(target) {
  const env = {
    ...process.env,
    YARDMASTER_FIREBASE_TARGET: target,
    YARDMASTER_FIREBASE_PROJECT: target === 'emulator' ? 'demo-86chaos' : 'chaos-test-d1601',
    CHAOS_BLOCK_LIVE_FIREBASE: target === 'emulator' ? '1' : '0',
  };
  delete env.NODE_TEST_CONTEXT;
  return cp.spawnSync(process.execPath, ['--test', 'api/failed-only-manifest-cross-version.test.cjs'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env,
  });
}

test('17.0.71 cross-version target validation resolves the active Firebase project while preserving historical baseline evidence', () => {
  const source = fs.readFileSync(fixture, 'utf8');
  assert.match(source, /const \{ expectedFirebaseProject \} = require\('\.\.\/scripts\/86chaos-firebase-target\.cjs'\);/);
  assert.equal((source.match(/firebaseProjectId: expectedFirebaseProject\(process\.env\)/g) || []).length, 3);
  assert.match(source, /environment-preflight\.json'\), \{ runId: 'baseline-run',[\s\S]*firebaseProjectId: 'chaos-test-d1601'/);
});

test('17.0.71 emulator-mode server regression executes all cross-version manifest cases against demo-86chaos', () => {
  const result = runCrossVersionFixture('emulator');
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.doesNotMatch(output, /Target Firebase project must be demo-86chaos, got chaos-test-d1601/);
});

test('17.0.71 live-mode server regression still accepts chaos-test-d1601', () => {
  const result = runCrossVersionFixture('live');
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
