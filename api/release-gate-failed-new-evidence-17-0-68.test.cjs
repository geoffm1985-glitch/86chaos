'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.68 exhaustive Prep declaration matches the rendered Food Prep control', () => {
  const matrix = read('tests/86chaos-release-gate/exhaustive-surface-matrix.cjs');
  assert.match(matrix, /prep:\s*\[\[\/\^food prep\$\/i\]/i);
  assert.doesNotMatch(matrix, /prep:\s*\[\[\/\^prep\$\/i\]/i);
});

test('17.0.68 sticky regression measures and scrolls the actual nearest vertical scrollport', () => {
  const source = read('tests/86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs');
  assert.match(source, /let scrollport = sticky\?\.parentElement \|\| null/);
  assert.match(source, /scrollport\.scrollHeight > scrollport\.clientHeight \+ 8/);
  assert.match(source, /expectedStickyViewportTop: Number\.isFinite\(computedStickyTop\) \? \(scrollportRect\?\.top \?\? 0\) \+ computedStickyTop/);
  assert.doesNotMatch(source, /expectedStickyViewportTop:[^\n]*shellRect/);
});

test('17.0.68 authenticated shell accepts the compact Active workspace header control', () => {
  const source = read('tests/e2e/utils/release-login-helper.cjs');
  assert.match(source, /getByRole\('button', \{ name: \/\^Active workspace\\b\/i \}\)/);
  assert.match(source, /Authenticated app shell should be ready without accepting the login logo as proof/);
});

test('17.0.68 emulator-only Firebase Auth CSP bootstrap noise is filtered narrowly', () => {
  const source = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
  assert.match(source, /function isExpectedEmulatorFirebaseAuthBootstrapNoise/);
  assert.match(source, /trim\(\)\.toLowerCase\(\) === 'emulator'/);
  assert.ok(source.includes("return /https:\\/\\/apis\\.google\\.com\\/js\\/api\\.js/i.test(value)"));
  assert.ok(source.includes("&& /content security policy|\\bcsp\\b|blocked/i.test(value)"));
  assert.match(source, /if \(!emulatorSelected\) return false/);
});

test('17.0.68 accessibility sweep retries a real missing nested state once after a route remount', () => {
  const source = read('tests/86chaos-release-gate/32-exhaustive-nested-accessibility.spec.cjs');
  assert.match(source, /if\(!applied\.ok&&state\.length\)/);
  assert.match(source, /gotoTab\(page,route\.tab,\{settleMs:350,timeout:8000,maxText:14000,force:true\}\)/);
  assert.match(source, /applied=await applyStatePath\(page,state,\{strict:false\}\)/);
  assert.match(source, /if\(!applied\.ok\)\{findings\.push\(\{route:route\.tab,state:state\.map\(String\),missing:true\}\)/);
});
