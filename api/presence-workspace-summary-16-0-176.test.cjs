'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'api/presence-workspace-summary.js'), 'utf8');
test('presence workspace summary is bounded and has tenant-scoped fallback', () => {
  assert.match(source, /function\s+timeoutAfter/);
  assert.match(source, /function\s+withTimeout/);
  assert.match(source, /statusSummary\/\$\{restaurantId\}/);
  assert.match(source, /firestore-livePresence-fallback/);
  assert.match(source, /where\('restaurantId',\s*'==',\s*restaurantId\)/);
  assert.match(source, /empty-safe-fallback/);
  assert.match(source, /timeoutMs/);
});
test('withTimeout helper is exported for bounded never-resolving promise coverage', () => {
  assert.match(source, /module\.exports\._test = \{[^}]*withTimeout/);
  assert.match(source, /Promise\.race\(\[promise, timeoutAfter\(ms, label\)\]\)/);
});
