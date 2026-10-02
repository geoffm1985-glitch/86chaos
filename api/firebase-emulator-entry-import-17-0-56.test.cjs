'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.56 app entry imports Firebase runtime target from defining module', () => {
  const entry = read('src/index.js');
  assert.match(entry, /import \{ firebaseEmulatorReadiness \} from ["']\.\/core\/appCore["'];/);
  assert.match(entry, /import \{ firebaseRuntimeTarget \} from ["']\.\/core\/firebaseTarget["'];/);
  assert.doesNotMatch(entry, /import\s*\{[^}]*firebaseRuntimeTarget[^}]*\}\s*from\s*["']\.\/core\/appCore["']/);
});

test('17.0.56 appCore keeps runtime target local and exports emulator readiness', () => {
  const appCore = read('src/core/appCore.js');
  assert.match(appCore, /import \{[^}]*firebaseRuntimeTarget[^}]*\} from ['"]\.\/firebaseTarget['"]/);
  assert.match(appCore, /export const firebaseEmulatorReadiness =/);
});

test('17.0.56 regression is wired into targeted and Playwright coverage', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['test:current-release-targeted'], /firebase-emulator-entry-import-17-0-56\.test\.cjs/);
  assert.match(pkg.scripts['test:current-release-targeted'], /validate-17-0-56\.js/);
  assert.equal(fs.existsSync(path.join(root, 'tests/86chaos-release-gate/68-firebase-emulator-entry-import-17-0-56.spec.cjs')), true);
});
