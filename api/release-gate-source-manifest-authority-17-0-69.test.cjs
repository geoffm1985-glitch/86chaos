'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const identity = require('../scripts/86chaos-release-gate/source-identity.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const target = 'scripts/86chaos-release-gate/failed-only-manifest-utils.cjs';

test('17.0.69 bundled manifest seals the exact failed-only manifest utility that drifted after 17.0.68', () => {
  const bundled = identity.readBundledSourceManifest(root);
  assert.ok(bundled);
  const row = bundled.files.find(entry => entry.file === target);
  assert.ok(row, `${target} must be present in the bundled source manifest`);
  const actual = identity.hash(identity.sourceBytes(target, fs.readFileSync(path.join(root, target))));
  assert.equal(row.sha256, actual);
});

test('17.0.69 bundled manifest and completed source tree have one authority', () => {
  const captured = identity.captureSourceIdentity(root);
  const bundled = identity.readBundledSourceManifest(root);
  assert.ok(bundled);
  assert.equal(bundled.sourceHash, captured.sourceHash);
  assert.deepEqual(bundled.files, captured.files);
});

test('17.0.69 exact source-manifest repair is mandatory in release-gate and Playwright inventory', () => {
  const universe = require('../scripts/86chaos-release-gate/release-test-universe.cjs');
  const releaseSpec = 'tests/86chaos-release-gate/81-source-manifest-authority-17-0-69.spec.cjs';
  const e2eSpec = 'tests/e2e/source-manifest-authority-17-0-69.spec.cjs';
  assert.equal(fs.existsSync(path.join(root, releaseSpec)), true);
  assert.equal(fs.existsSync(path.join(root, e2eSpec)), true);
  assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec));
  const workflow = read('.github/workflows/testing-targeted-delta.yml');
  assert.match(workflow, /81-source-manifest-authority-17-0-69\.spec\.cjs/);
  assert.match(workflow, /tests\/e2e\/source-manifest-authority-17-0-69\.spec\.cjs/);
});
