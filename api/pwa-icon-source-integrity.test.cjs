'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { validateIconSourcePackage, analyzePngSafeArea } = require('../scripts/86chaos-release-gate/icon-source-validator.cjs');

const root = path.join(__dirname, '..');

test('PWA manifest and HTML icon declarations all resolve to real source assets', () => {
  const report = validateIconSourcePackage(root);
  assert.equal(report.ok, true, report.errors.join('\n'));
  const paths = report.inventory.map(i => i.relPath);
  for (const required of [
    'public/86chaos-icon-16-v2.png',
    'public/86chaos-icon-32-v2.png',
    'public/86chaos-icon-180-v2.png',
    'public/86chaos-pwa-192-v4.png',
    'public/86chaos-pwa-512-v4.png',
    'public/86chaos-maskable-192-v4.png',
    'public/86chaos-maskable-512-v4.png',
    'public/favicon.ico',
  ]) assert.ok(paths.includes(required), `${required} should be declared and packaged`);
});

test('PWA launch assets keep the full artwork inside a safe outer canvas', () => {
  for (const rel of [
    'public/86chaos-pwa-192-v4.png',
    'public/86chaos-pwa-512-v4.png',
    'public/86chaos-maskable-192-v4.png',
    'public/86chaos-maskable-512-v4.png',
  ]) {
    const analysis = analyzePngSafeArea(fs.readFileSync(path.join(root, rel)));
    assert.ok(analysis, `${rel} should be analyzable`);
    assert.ok(analysis.minMarginRatio >= 0.17, `${rel} should keep at least 17% safe canvas margin, got ${(analysis.minMarginRatio * 100).toFixed(1)}%`);
    assert.ok(analysis.minMarginRatio <= 0.25, `${rel} should still show recognizable artwork, got ${(analysis.minMarginRatio * 100).toFixed(1)}%`);
  }
});
