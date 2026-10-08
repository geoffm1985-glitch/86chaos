'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('17.0.84 Ghost Request Off fixture keeps the seeded conflict date selectable', () => {
  const profile = read('tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs');
  const ghostSpec = read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs');
  assert.match(profile, /timeOffPolicy:\s*\{\s*enabled:\s*false,/);
  assert.match(ghostSpec, /ghostRequestOffConflictDate/);
  assert.match(ghostSpec, /Request Off conflict date cell for \$\{conflictDate\} should be selectable/);
});

test('17.0.84 export/import audit allows only one transient auth recovery', () => {
  const spec = read('tests/86chaos-full-audit/14-export-import-regression-graveyard.spec.cjs');
  assert.match(spec, /let authRecoveries = 0/);
  assert.match(spec, /authRecoveries[\s\S]{0,260}toBe\(0\)/);
  assert.match(spec, /must remain authenticated after at most one recovery/);
});

test('17.0.84 chunk resilience accepts successful one-shot recovery without requiring a stale overlay', () => {
  const spec = read('tests/86chaos-release-gate/17-resilience-chunk-offline.spec.cjs');
  assert.match(spec, /recoveredHealthyApp/);
  assert.match(spec, /usableRecoveryUi/);
  assert.match(spec, /recoveredHealthyApp \|\| usableRecoveryUi/);
  assert.doesNotMatch(spec, /Repeated chunk failure must provide a usable update\/recovery action/);
});

test('17.0.84 runtime coverage performs a real owner logout before System Administrator traversal', () => {
  const spec = read('tests/86chaos-release-gate/21-runtime-code-coverage.spec.cjs');
  assert.match(spec, /name: \/open sign out\|log out\/i/);
  assert.match(spec, /reload after logout must stay signed out/);
  assert.match(spec, /Verified System Administrator must actually enter godmode before runtime coverage is scored/);
  assert.doesNotMatch(spec, /page\.context\(\)\.clearCookies\(\)[\s\S]{0,120}about:blank/);
});
