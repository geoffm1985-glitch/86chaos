const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.js'), 'utf8');

test('installed PWA uses standalone detection and does not use window.close', () => {
  assert.match(app, /const CHAOS_PWA_BACK_EXIT_WINDOW_MS = 2000/);
  assert.match(app, /function|const isStandalone86ChaosPwa/);
  assert.match(app, /display-mode: standalone/);
  assert.match(app, /window\.navigator\?\.standalone === true/);
  assert.doesNotMatch(app, /window\.close\s*\(/);
});

test('installed PWA tab navigation replaces tab URL instead of stacking every top-level tab', () => {
  assert.match(app, /writeTopLevelTabHistory/);
  assert.match(app, /isStandalone86ChaosPwa\(\)\) \{\s*window\.history\.replaceState\(\{ \.\.\.currentState, tab: normalized, chaosAppShell: true, chaosPwaBackGuard: true \}/s);
  assert.match(app, /else \{\s*window\.history\.pushState\(\{ tab: normalized \}/s);
});

test('installed PWA first Back shows toast, second Back uses browser history to leave', () => {
  assert.match(app, /Press back again to exit\./);
  assert.match(app, /chaosPwaBackBase/);
  assert.match(app, /chaosPwaBackGuard/);
  assert.match(app, /state\.armed = true/);
  assert.match(app, /setTimeout\(\(\) => \{\s*state\.armed = false;\s*state\.timer = null;\s*\}, CHAOS_PWA_BACK_EXIT_WINDOW_MS\)/s);
  assert.match(app, /window\.history\.back\(\)/);
});
