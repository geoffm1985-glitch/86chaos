'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const i18nNode = require('../src/core/i18n.cjs');

function quotedKeyRegex(key) {
  const escaped = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`['\"]${escaped}['\"]\\s*:`);
}

test('17.0.28 browser i18n runtime does not import the Node-only .cjs translation module', () => {
  const browser = read('src/core/i18n.js');
  assert.doesNotMatch(browser, /from\s+['\"][^'\"]+\.cjs['\"]/i);
  assert.doesNotMatch(browser, /require\([^)]*i18n\.cjs/i);
  assert.doesNotMatch(browser, /module\.exports\s*=/);
  assert.match(browser, /const\s+SUPPORTED_APP_LANGUAGES\s*=\s*Object\.freeze/);
  assert.match(browser, /function\s+normalizeAppLanguage\s*\(/);
  assert.match(browser, /function\s+translate\s*\(/);
  assert.match(browser, /export\s+const\s+I18nProvider/);
});

test('17.0.28 browser and Node i18n dictionaries keep the same Phase 1 translation keys', () => {
  const browser = read('src/core/i18n.js');
  for (const language of ['en', 'es']) {
    for (const key of Object.keys(i18nNode.STRINGS[language] || {})) {
      assert.match(browser, quotedKeyRegex(key), `browser i18n is missing ${language}:${key}`);
    }
  }
  assert.deepEqual(i18nNode.getMissingTranslationKeys('es'), []);
});

test('17.0.28 application mounts the browser-safe provider and release-gate scope retains deployed load coverage', () => {
  const app = read('src/App.js');
  const scope = read('scripts/86chaos-release-gate/current-release-repair-scope.cjs');
  const universe = read('scripts/86chaos-release-gate/release-test-universe.cjs');
  assert.match(app, /from ['\"]\.\/core\/i18n['\"]/);
  assert.doesNotMatch(app, /core\/i18n\.cjs/);
  assert.match(app, /<I18nProvider language=\{appLanguage\}>/);
  assert.match(scope, /CURRENT_RELEASE_VERSION = '17\.0\.37'/);
  assert.match(scope, /08-phase1-spanish-interface\.spec\.cjs/);
  assert.match(scope, /09-schedule-builder-shift-assignment\.spec\.cjs/);
  assert.match(scope, /10-app-bootstrap-i18n-runtime\.spec\.cjs/);
  assert.match(universe, /86chaos-new-implementations\/\*\*\/\*\.spec\.cjs/);
});
