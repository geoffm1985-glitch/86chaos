'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const target = require('../scripts/86chaos-firebase-target.cjs');

test('17.0.58 failed+new config propagates the selected emulator target before Playwright evaluates tests', () => {
  const config = read('playwright.failed-release.config.cjs');
  const normalize = "require('./scripts/86chaos-firebase-target.cjs').applyFirebaseEmulatorEnv(process.env);";
  assert.ok(config.includes(normalize));
  assert.ok(config.indexOf(normalize) < config.indexOf("const baseURL ="), 'Firebase target normalization must run before baseURL and test config evaluation.');
  const env = { YARDMASTER_FIREBASE_TARGET: 'emulator' };
  const selected = target.applyFirebaseEmulatorEnv(env);
  assert.equal(selected.target, 'EMULATOR');
  assert.equal(env.REACT_APP_FIREBASE_PROJECT_ID, 'demo-86chaos');
  assert.equal(env.REACT_APP_86CHAOS_FIREBASE_TARGET, undefined, 'generic normalization must not invent a CRA target key when Yardmaster already supplies the canonical selector');
});

test('17.0.58 Firebase bridge regression resolves the canonical target instead of guessing LIVE from one env key', () => {
  const spec = read('tests/86chaos-release-gate/66-firebase-emulator-bridge-17-0-54.spec.cjs');
  assert.match(spec, /getFirebaseTarget\(process\.env\)\.emulator/);
  assert.doesNotMatch(spec, /REACT_APP_86CHAOS_FIREBASE_TARGET \|\| 'live'/);
  assert.equal(target.getFirebaseTarget({ YARDMASTER_FIREBASE_TARGET: 'emulator' }).target, 'EMULATOR');
  assert.equal(target.getFirebaseTarget({ REACT_APP_86CHAOS_FIREBASE_TARGET: 'live' }).target, 'LIVE');
});

test('17.0.58 historical release-gate safeguards survive later builds without an obsolete exact-version failure', () => {
  const spec = read('tests/86chaos-release-gate/61-release-gate-surgical-repairs-17-0-46.spec.cjs');
  assert.doesNotMatch(spec, /toBe\(['"]17\.0\.52['"]\)/);
  assert.match(spec, /pkg\.version\)\.toMatch/);
});
