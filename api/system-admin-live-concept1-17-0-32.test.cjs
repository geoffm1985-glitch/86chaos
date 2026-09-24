'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const i18n = require('../src/core/i18n.cjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.32 applies Concept 1 to the actual System Administrator route component', () => {
  const app = read('src/App.js');
  const management = read('src/features/management.jsx');
  assert.match(app, /lazyFeature\(\(\) => import\('\.\/features\/management'\), 'TabGodMode'\)/);
  assert.match(management, /const TabGodMode = \(\{ appUser, addToast, setGhostTenant, setActiveTab \}\) => \{/);
  assert.match(management, /data-testid="system-admin-concept1-exact-home"/);
  assert.match(management, /data-testid="system-admin-directory-card"/);
  assert.match(management, /data-testid="system-admin-directory-card"/);
  assert.match(management, /data-testid="system-admin-directory-card"/);
  assert.match(management, /admin-concept1-exact-hero/);
  assert.match(management, /admin37-featured-grid/);
  assert.match(management, /admin37-all-tools-grid/);
});

test('17.0.32 Spanish Phase 2 is wired into the live System Administrator shell', () => {
  const management = read('src/features/management.jsx');
  assert.match(management, /const \{ t \} = useI18n\(\);/);
  assert.match(management, /t\('admin\.title'/);
  assert.match(management, /t\('admin\.concept\.subtitle'/);
  assert.match(management, /adminGroupTitleKey/);
  assert.match(management, /adminTabLabelKey/);
  assert.match(management, /localizedAdminTabGroups/);
  assert.deepEqual(i18n.getMissingTranslationKeys('es'), []);
  assert.equal(i18n.translate('es', 'admin.group.start'), 'Empieza aquí');
  assert.equal(i18n.translate('es', 'admin.tab.security'), 'Centro de seguridad');
  assert.equal(i18n.translate('es', 'admin.tab.tenants'), 'Restaurantes / clientes');
});

test('17.0.32 delta runner always pins APP_URL and CHAOS_BASE_URL to testing.86chaos.com', () => {
  const runner = read('RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1');
  assert.match(runner, /\$canonicalPreviewUrl = 'https:\/\/testing\.86chaos\.com\/'/);
  assert.match(runner, /canonical testing branch domain/);
  assert.match(runner, /Old \.env\.test\.local or shell values must never drag the gate back to the retired branch alias/);
  const branch = runner.slice(runner.indexOf("if ($Key -eq 'APP_URL' -or $Key -eq 'CHAOS_BASE_URL')"), runner.indexOf("if ($testValue)", runner.indexOf("if ($Key -eq 'APP_URL' -or $Key -eq 'CHAOS_BASE_URL')")));
  assert.match(branch, /return \[pscustomobject\]@\{ Value = \$canonicalPreviewUrl/);
  assert.doesNotMatch(branch, /Source = '\.env\.test\.local'/);
});
