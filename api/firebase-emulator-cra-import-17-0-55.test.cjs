'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.55 CRA-safe emulator config stays inside src and remains single-source', () => {
  const browserConfig = path.join(root, 'src', 'core', 'firebase-emulator.config.json');
  const formerRootConfig = path.join(root, 'firebase-emulator.config.json');
  assert.equal(fs.existsSync(browserConfig), true);
  assert.equal(fs.existsSync(formerRootConfig), false);
  const relativeToSrc = path.relative(path.join(root, 'src'), browserConfig);
  assert.equal(relativeToSrc.startsWith('..'), false);
  assert.match(read('src/core/firebaseTarget.js'), /import emulatorConfig from '\.\/firebase-emulator\.config\.json'/);
  assert.match(read('scripts/86chaos-firebase-target.cjs'), /require\('\.\.\/src\/core\/firebase-emulator\.config\.json'\)/);
});

test('17.0.55 shared emulator config preserves the 17.0.54 safety contract', () => {
  const config = JSON.parse(read('src/core/firebase-emulator.config.json'));
  assert.equal(config.projectId, 'demo-86chaos');
  assert.equal(config.defaultHost, '127.0.0.1');
  assert.deepEqual(config.ports, { firestore: 8080, auth: 9099, functions: 5001, database: 9000, storage: 9199 });
  assert.equal(config.liveTestingProjectId, 'chaos-test-d1601');
  assert.equal(config.productionProjectId, 'cheers-34b8d');
});

test('17.0.55 release identity and Playwright regression are wired', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '17.0.55');
  assert.match(pkg.scripts['test:current-release-targeted'], /firebase-emulator-cra-import-17-0-55\.test\.cjs/);
  assert.match(pkg.scripts['test:current-release-targeted'], /validate-17-0-55\.js/);
  assert.equal(fs.existsSync(path.join(root, 'tests/86chaos-release-gate/67-firebase-emulator-cra-build-17-0-55.spec.cjs')), true);
});
