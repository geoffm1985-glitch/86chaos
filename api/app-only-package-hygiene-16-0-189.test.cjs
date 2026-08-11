'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { findAppOnlyHygieneOffenders } = require('../scripts/86chaos-release-gate/app-only-package-hygiene.cjs');

const root = path.resolve(__dirname, '..');

test('app-only hygiene rejects forbidden source-controlled artifacts and packaged local secrets', () => {
  assert.deepEqual(findAppOnlyHygieneOffenders(root), []);
});

test('source inventory excludes generated release-gate results from package scans', () => {
  const inventory = fs.readFileSync(path.join(root, 'scripts/86chaos-release-gate/source-inventory.cjs'), 'utf8');
  assert.match(inventory, /test-results/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'scripts/validate-16-0-190.js'), 'utf8'), /test-results\/.*allowed/i);
  assert.match(inventory, /node_modules/);
  assert.match(inventory, /build/);
});
