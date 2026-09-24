'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const i18n = require('../src/core/i18n.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.33 replaces the old attention dashboard with the Concept 1 home shell', () => {
  const management = read('src/features/management.jsx');
  assert.match(management, /data-testid="system-admin-concept1-exact-home"/);
  assert.match(management, /data-testid="system-admin-directory-card"/);
  for (const id of ['roles','push','security','forensics','support','deployment']) assert.match(management, new RegExp(`data-admin-tab=\{tab\.id\}|id:'${id}'`));
  assert.doesNotMatch(management, /What needs your attention\?/);
  assert.doesNotMatch(management, />Priority list</);
  assert.doesNotMatch(management, />Quick work</);
  assert.doesNotMatch(management, /Everything is still here, just quieter\./);
  assert.doesNotMatch(management, /system-admin-live-concept1|system-admin-desktop-directory|system-admin-mobile-directory|system-admin-live-nav-card/);
});

test('17.0.33 Concept 1 styling has distinct desktop and mobile geometry matching the chosen mockup', () => {
  const css = read('src/styles.css');
  assert.match(css, /17\.0\.33 System Administrator Concept 1 exact-home rebuild/);
  assert.match(css, /admin-concept1-directory-grid[\s\S]*repeat\(3/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*admin-concept1-directory-grid[\s\S]*repeat\(2/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /#eda77c/i);
  assert.match(css, /border-radius: 16px/);
});

test('17.0.33 keeps Spanish coverage for the exact Concept 1 home', () => {
  assert.deepEqual(i18n.getMissingTranslationKeys('es'), []);
  assert.equal(i18n.translate('es', 'admin.concept.roles'), 'Administrador de permisos y roles');
  assert.equal(i18n.translate('es', 'admin.concept.backup'), 'Centro de respaldos');
  assert.equal(i18n.translate('es', 'admin.concept.audit'), 'Auditoría / registros');
});

test('17.0.33 preserves the testing-domain pin repair', () => {
  const runner = read('RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1');
  assert.match(runner, /\$canonicalPreviewUrl = 'https:\/\/testing\.86chaos\.com\/'/);
  assert.match(runner, /Old \.env\.test\.local or shell values must never drag the gate back to the retired branch alias/);
});
