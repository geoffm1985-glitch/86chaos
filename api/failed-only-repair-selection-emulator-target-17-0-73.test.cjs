'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'api/failed-only-repair-selection-16-0-153.test.cjs');

function runRecoveryFixture(target) {
  const env = {
    ...process.env,
    YARDMASTER_FIREBASE_TARGET: target,
    YARDMASTER_FIREBASE_PROJECT: target === 'emulator' ? 'demo-86chaos' : 'chaos-test-d1601',
    CHAOS_BLOCK_LIVE_FIREBASE: target === 'emulator' ? '1' : '0',
  };
  delete env.NODE_TEST_CONTEXT;
  return cp.spawnSync(process.execPath, ['--test', 'api/failed-only-repair-selection-16-0-153.test.cjs'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env,
  });
}

test('17.0.73 recovery fixture keeps historical live-project evidence and resolves only current validation through the shared Firebase target', () => {
  const source = fs.readFileSync(fixture, 'utf8');
  assert.match(source, /const \{ expectedFirebaseProject \} = require\('\.\.\/scripts\/86chaos-firebase-target\.cjs'\);/);
  assert.match(source, /writeJson\(path\.join\(dir, 'environment-preflight\.json'\), \{[\s\S]*firebaseProjectId: 'chaos-test-d1601'/);
  assert.match(source, /86chaos-play-store-release-gate-summary-[\s\S]*firebaseProjectId: 'chaos-test-d1601'/);
  assert.match(source, /currentSourceVersion: '16\.0\.159'[\s\S]*firebaseProjectId: expectedFirebaseProject\(process\.env\)/);
});

test('17.0.73 failed-only recovery fixture passes in emulator and live target modes', () => {
  for (const target of ['emulator', 'live']) {
    const result = runRecoveryFixture(target);
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    assert.equal(result.status, 0, `${target}\n${output}`);
    assert.doesNotMatch(output, /Target Firebase project must be demo-86chaos, got chaos-test-d1601/);
  }
});
