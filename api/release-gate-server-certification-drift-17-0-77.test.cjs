'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const repairedServerTests = [
  'api/release-gate-hostile-fixture-manifest-17-0-70.test.cjs',
  'api/release-gate-maturity-16-0-207.test.cjs',
  'api/release-gate-maturity-16-0-209.test.cjs',
  'api/release-gate-runner-observability.test.cjs',
  'api/schedule-warning-request-off-controls.test.cjs',
  'api/spanish-release-gate-fidelity-17-0-29.test.cjs',
];

test('17.0.77 stale server certification assertions track current contracts without weakening behavior', () => {
  const hostile = read(repairedServerTests[0]);
  assert.match(hostile, /scripts\?\.\['test:source'\]/);
  assert.match(hostile, /validatorMatch\[1\]/);
  assert.doesNotMatch(hostile, /cp\.spawnSync\(process\.execPath, \['scripts\/validate-17-0-70\.js'\]/);

  const maturity207 = read(repairedServerTests[1]);
  assert.match(maturity207, /role="tab"\[\\s\\S\]\{0,180\}aria-label/);

  const maturity209 = read(repairedServerTests[2]);
  assert.match(maturity209, /getByTestId\\\('schedule-copilot-warnings-tab'/);

  const observability = read(repairedServerTests[3]);
  assert.match(observability, /yardmaster-dependency-install\.cjs/);
  assert.match(observability, /dependencyInstaller/);
  assert.match(observability, /'--timeout','1800'/);

  const coverage = read(repairedServerTests[4]);
  assert.match(coverage, /current QA seed deduplicates duplicate bartender shifts for coverage/);
  assert.match(coverage, /assert\.equal\(rows\[0\]\.existing, 2\)/);
  assert.match(coverage, /assert\.equal\(rows\[0\]\.over, 1\)/);

  const spanish = read(repairedServerTests[5]);
  assert.match(spanish, /toHaveAttribute.*value/);
  assert.match(spanish, /selectOption.*value/);
  assert.match(spanish, /saveLanguagePreference.*es/);
});

test('17.0.77 exact previously failing server files all pass together', () => {
  const result = cp.spawnSync(process.execPath, ['--test', ...repairedServerTests], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
