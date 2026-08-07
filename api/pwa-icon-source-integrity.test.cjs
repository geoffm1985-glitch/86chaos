'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { validateIconSourcePackage } = require('../scripts/86chaos-release-gate/icon-source-validator.cjs');

test('PWA manifest and HTML icon declarations all resolve to real source assets', () => {
  const report = validateIconSourcePackage(path.join(__dirname, '..'));
  assert.equal(report.ok, true, report.errors.join('\n'));
  const paths = report.inventory.map(i => i.relPath);
  for (const required of [
    'public/86chaos-icon-16-v1.png',
    'public/86chaos-icon-32-v1.png',
    'public/86chaos-icon-180-v1.png',
    'public/86chaos-icon-192-v1.png',
    'public/86chaos-icon-512-v1.png',
    'public/86chaos-maskable-192-v1.png',
    'public/86chaos-maskable-512-v1.png',
    'public/favicon.ico',
  ]) assert.ok(paths.includes(required), `${required} should be declared and packaged`);
});
