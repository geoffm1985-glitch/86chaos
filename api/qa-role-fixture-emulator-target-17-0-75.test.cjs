'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const cp = require('node:child_process');
const { expectedFirebaseProject } = require('../scripts/86chaos-firebase-target.cjs');

const root = path.resolve(__dirname, '..');

function runRoleFixture(target) {
  const env = {
    ...process.env,
    YARDMASTER_FIREBASE_TARGET: target,
    CHAOS_FIREBASE_TARGET: target
  };

  const result = cp.spawnSync(
    process.execPath,
    ['--test', 'api/qa-role-definitions.test.cjs'],
    {
      cwd: root,
      env,
      encoding: 'utf8',
      timeout: 30000,
      windowsHide: true
    }
  );

  return {
    ...result,
    output: [result.stdout, result.stderr].filter(Boolean).join('\n')
  };
}

test('17.0.75 QA role definition fixture passes under emulator Firebase target', () => {
  const env = {
    ...process.env,
    YARDMASTER_FIREBASE_TARGET: 'emulator'
  };

  assert.equal(expectedFirebaseProject(env), 'demo-86chaos');

  const result = runRoleFixture('emulator');
  assert.equal(result.status, 0, result.output);
});

test('17.0.75 QA role definition fixture still passes under live Firebase target', () => {
  const env = {
    ...process.env,
    YARDMASTER_FIREBASE_TARGET: 'live'
  };

  assert.equal(expectedFirebaseProject(env), 'chaos-test-d1601');

  const result = runRoleFixture('live');
  assert.equal(result.status, 0, result.output);
});
