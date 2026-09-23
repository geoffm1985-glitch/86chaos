'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const i18n = require('../src/core/i18n.cjs');
const targets = require('../scripts/86chaos-release-gate/vercel-targets.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.31 System Administrator concept 1 refresh keeps the same tools but uses a cleaner shell and card navigation', () => {
  const app = read('src/App.js');
  const source = read('src/features/management.jsx');
  assert.match(app, /import\('\.\/features\/management'\), 'TabGodMode'/);
  assert.match(source, /useI18n/);
  assert.match(source, /data-testid="system-admin-concept1-exact-home"/);
  assert.match(source, /data-testid="system-admin-concept1-card"/);
  assert.match(source, /admin\.title/);
  assert.match(source, /admin\.concept\.subtitle/);
  assert.match(source, /admin-concept1-exact-hero/);
  assert.match(source, /admin-concept1-exact-grid-secondary/);
});

test('17.0.31 Spanish Phase 2 extends translation coverage into the refreshed System Administrator tab', () => {
  assert.deepEqual(i18n.getMissingTranslationKeys('es'), []);
  assert.equal(i18n.translate('es', 'admin.title'), 'Administrador del sistema');
  assert.equal(i18n.translate('es', 'admin.section.metrics'), 'Métricas');
  assert.match(i18n.translate('es', 'admin.summary').toLowerCase(), /seguridad|plataforma/);
  assert.match(read('src/core/i18n.js'), /'admin\.title': 'Administrador del sistema'/);
  assert.match(read('src/core/i18n.cjs'), /'admin\.section\.clients': 'Clientes'/);
});

test('17.0.31 stale testing-target guidance names testing.86chaos.com and the rerun path', () => {
  const result = targets.validateReleaseTarget({
    appUrl: 'https://testing.86chaos.com',
    chaosBaseUrl: 'https://testing.86chaos.com/',
    expectedVersion: '17.0.31',
    sourceVersion: '17.0.31',
    deployedVersion: '17.0.30',
  });
  assert.equal(result.ok, false);
  const joined = result.errors.join('\n');
  assert.match(joined, /Testing target is stale/);
  assert.match(joined, /testing\.86chaos\.com/);
  assert.match(joined, /rerun the release gate/i);
});
