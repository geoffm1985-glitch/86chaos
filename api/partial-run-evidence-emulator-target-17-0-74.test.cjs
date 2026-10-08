'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');
const subject = 'api/partial-run-evidence-16-0-231.test.cjs';

function runTarget(target) {
  const env = {
    ...process.env,
    YARDMASTER_FIREBASE_TARGET: target,
    CHAOS_FIREBASE_TARGET: target,
  };
  delete env.NODE_TEST_CONTEXT;

  return cp.spawnSync(
    process.execPath,
    ['--test', subject],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env,
    }
  );
}

test('17.0.74 legacy partial-resume fixture resolves the active Firebase project instead of a live-project literal', () => {
  const source = fs.readFileSync(path.join(root, subject), 'utf8');
  assert.match(source, /expectedFirebaseProject/);
  assert.equal(
    (source.match(/firebaseProjectId: expectedFirebaseProject\(process\.env\)/g) || []).length,
    2
  );
  assert.doesNotMatch(source, /firebaseProjectId: 'chaos-test-d1601'/);
});

for (const target of ['emulator', 'live']) {
  test(`17.0.74 historical partial-run server regression passes under ${target} Firebase target`, () => {
    const result = runTarget(target);
    const output =
      String(result.stdout || '') +
      '\n' +
      String(result.stderr || '');

    assert.equal(result.status, 0, output);
    assert.doesNotMatch(
      output,
      /Partial resume refused: the test workspace environment does not match/
    );
  });
}