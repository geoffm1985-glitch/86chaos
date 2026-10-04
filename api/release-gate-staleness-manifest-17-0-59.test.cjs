'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const identity = require('../scripts/86chaos-release-gate/source-identity.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));

test('17.0.59 historical emulator-entry coverage follows the active validator instead of a stale patch version', () => {
  const historical = read('api/firebase-emulator-entry-import-17-0-56.test.cjs');
  const activeValidator = `validate-${pkg.version.replace(/\./g, '-')}.js`;
  assert.doesNotMatch(historical, /validate-17-0-57\.js/);
  assert.match(historical, /pkg\.version\.replace\(\/\\\.\/g, '-'\)/);
  assert.ok(pkg.scripts['test:current-release-targeted'].includes(activeValidator));
  assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-staleness-manifest-17-0-59\.test\.cjs/);
});

test('17.0.59 bundled source manifest matches the completed repaired source tree', () => {
  const captured = identity.captureSourceIdentity(root);
  const bundled = identity.readBundledSourceManifest(root);
  assert.ok(bundled);
  assert.equal(bundled.sourceHash, captured.sourceHash);
  assert.deepEqual(bundled.files, captured.files);
});

test('17.0.59 exact repair is permanent in release-gate and Playwright inventory', () => {
  const universe = require('../scripts/86chaos-release-gate/release-test-universe.cjs');
  const spec = 'tests/86chaos-release-gate/71-release-gate-staleness-manifest-17-0-59.spec.cjs';
  assert.equal(fs.existsSync(path.join(root, spec)), true);
  assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(spec));
  const workflow = read('.github/workflows/testing-targeted-delta.yml');
  assert.match(workflow, /71-release-gate-staleness-manifest-17-0-59\.spec\.cjs/);
});
