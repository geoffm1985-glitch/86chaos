'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');
const wrapper = path.join(root, 'api/failed-only-manifest-emulator-target-17-0-71.test.cjs');

function runWrapperWithSpecReporter() {
  const env = {
    ...process.env,
    NODE_OPTIONS: '--test-reporter=spec',
  };
  delete env.NODE_TEST_CONTEXT;
  return cp.spawnSync(process.execPath, ['--test', 'api/failed-only-manifest-emulator-target-17-0-71.test.cjs'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env,
  });
}

test('17.0.72 repaired wrapper does not depend on TAP pass/fail summary text', () => {
  const source = fs.readFileSync(wrapper, 'utf8');
  assert.doesNotMatch(source, /# pass 11/);
  assert.doesNotMatch(source, /# fail 0/);
  assert.match(source, /assert\.equal\(result\.status, 0/);
  assert.match(source, /doesNotMatch\(output, \/Target Firebase project must be demo-86chaos/);
});

test('17.0.72 nested cross-version regression passes with the spec reporter in emulator and live target modes', () => {
  const result = runWrapperWithSpecReporter();
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  assert.equal(result.status, 0, output);
  assert.match(output, /emulator-mode server regression executes all cross-version manifest cases against demo-86chaos/);
  assert.match(output, /live-mode server regression still accepts chaos-test-d1601/);
  assert.doesNotMatch(output, /AssertionError \[ERR_ASSERTION\]: The input did not match the regular expression \/# pass 11\//);
});
