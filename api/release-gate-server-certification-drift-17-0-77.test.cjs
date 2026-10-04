'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exactServerFiles = [
  'api/release-gate-hostile-fixture-manifest-17-0-70.test.cjs',
  'api/release-gate-maturity-16-0-207.test.cjs',
  'api/release-gate-maturity-16-0-209.test.cjs',
  'api/release-gate-runner-observability.test.cjs',
  'api/schedule-warning-request-off-controls.test.cjs',
  'api/spanish-release-gate-fidelity-17-0-29.test.cjs',
];
test('17.0.77 stale server certification assertions track current contracts without weakening behavior', () => {
  const hostile = read(exactServerFiles[0]);
  const maturity207 = read(exactServerFiles[1]);
  const maturity209 = read(exactServerFiles[2]);
  const observability = read(exactServerFiles[3]);
  const schedule = read(exactServerFiles[4]);
  const spanish = read(exactServerFiles[5]);
  assert.match(hostile, /scripts\['test:source'\]/);
  assert.doesNotMatch(hostile, /cp\.spawnSync\(process\.execPath, \['scripts\/validate-17-0-70\.js'\]/);
  assert.match(maturity207, /role=\"tab\"\[\\s\\S\]/);
  assert.match(maturity209, /schedule-copilot-warnings-tab/);
  assert.match(observability, /yardmaster-dependency-install/);
  assert.match(observability, /timed out after 30 minutes/);
  assert.match(schedule, /assert\.equal\(rows\[0\]\.existing, 2\)/);
  assert.match(schedule, /assert\.equal\(rows\[0\]\.target, 1\)/);
  assert.match(spanish, /toHaveAttribute.*value/);
  assert.match(spanish, /saveLanguagePreference.*es/);
});
test('17.0.77 exact previously failing server files all pass together', () => {
  const result = cp.spawnSync(process.execPath, ['--test', ...exactServerFiles], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
