'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const localIsolation = path.join(root, 'api', 'release-gate-local-regression-env-isolation-17-0-22.test.cjs');
const harnessIsolation = path.join(root, 'api', 'release-gate-harness-env-isolation-17-0-21.test.cjs');
const pkg = require(path.join(root, 'package.json'));

test('17.0.23 nested node:test success detection is reporter-agnostic', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-1723-reporter-'));
  try {
    const fixture = path.join(dir, 'reporter-compatible.test.cjs');
    fs.writeFileSync(fixture, `
      const test = require('node:test');
      const assert = require('node:assert/strict');
      test('reporter compatible nested child', () => assert.equal(2 + 2, 4));
    `);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const result = cp.spawnSync(process.execPath, ['--test', fixture], {
      cwd: root,
      env,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
    });
    assert.equal(result.status, 0, `nested child must pass regardless of reporter format\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
    assert.match(result.stdout, /reporter compatible nested child/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('17.0.23 historical nested-child regressions do not require TAP ok/not ok prefixes', () => {
  for (const file of [localIsolation, harnessIsolation]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\/ok 1 -/);
    assert.doesNotMatch(source, /\/not ok 1 -/);
  }
});

test('17.0.23 current repair command includes reporter compatibility before historical environment regressions', () => {
  const command = pkg.scripts['test:repair:17.0.23'];
  assert.ok(command, '17.0.23 repair command is required');
  const reporter = command.indexOf('release-gate-node-test-reporter-compatibility-17-0-23.test.cjs');
  const local = command.indexOf('release-gate-local-regression-env-isolation-17-0-22.test.cjs');
  const harness = command.indexOf('release-gate-harness-env-isolation-17-0-21.test.cjs');
  assert.ok(reporter >= 0 && local > reporter && harness > local);
});
