'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const i18n = require('../src/core/i18n.cjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.26 Phase 1 Spanish dictionary is complete and English remains the fallback', () => {
  assert.deepEqual(i18n.getMissingTranslationKeys('es'), []);
  assert.equal(i18n.normalizeAppLanguage('es-MX'), 'es');
  assert.equal(i18n.normalizeAppLanguage('Español'), 'es');
  assert.equal(i18n.normalizeAppLanguage('fr'), 'en');
  assert.equal(i18n.translate('es', 'drawer.timeClockSchedule'), 'Reloj y horario');
  assert.equal(i18n.translate('es', 'schedule.clockIn'), 'FICHAR ENTRADA');
  assert.equal(i18n.translate('es', 'builder.assign', { count: 3 }), 'Asignar (3)');
  assert.equal(i18n.translate('es', 'requestOff.blackoutDates'), 'Días bloqueados');
  assert.equal(i18n.translate('es', 'prep.foodPrep'), 'Preparación');
  assert.equal(i18n.translate('es', 'missing.key', {}, 'Fallback copy'), 'Fallback copy');
});

test('17.0.26 Phase 1 Spanish date and month formatting uses a Spanish locale', () => {
  assert.match(i18n.formatLocalizedMonth('2026-11', 'es').toLowerCase(), /noviembre/);
  assert.match(i18n.formatLocalizedFullDate('2026-11-12', 'es').toLowerCase(), /noviembre/);
  assert.match(i18n.formatLocalizedDate('2026-11-12', 'es').toLowerCase(), /nov/);
});

test('17.0.26 language preference is per user and drives the application provider', () => {
  const app = read('src/App.js');
  const management = read('src/features/management.jsx');
  assert.match(app, /I18nProvider/);
  assert.match(app, /liveAppUser\?\.preferences\?\.language/);
  assert.match(app, /document\.documentElement\.lang = appLanguage === 'es' \? 'es' : 'en'/);
  assert.match(management, /data-testid="app-language-select"/);
  assert.match(management, /preferences:\s*\{[\s\S]*\blanguage\b/);
  assert.match(management, /LANGUAGE_STORAGE_KEY/);
  assert.doesNotMatch(management, /systemSettings:[\s\S]{0,180}\blanguage\b/);
});

test('17.0.26 Phase 1 surfaces use translation keys instead of browser auto-translation', () => {
  const common = read('src/components/common.jsx');
  const operations = read('src/features/operations.jsx');
  const schedule = read('src/features/schedule.jsx');
  assert.match(common, /t\('drawer\.timeClockSchedule'\)/);
  assert.match(common, /t\('drawer\.prepTasks'\)/);
  assert.match(common, /t\('drawer\.settings'\)/);
  assert.match(operations, /t\('today\.managerBrief'\)/);
  assert.match(operations, /t\('today\.needAttention'\)/);
  assert.match(operations, /t\('prep\.foodPrep'\)/);
  assert.match(schedule, /t\('schedule\.mySchedule'\)/);
  assert.match(schedule, /t\('schedule\.clockIn'\)/);
  assert.match(schedule, /t\('builder\.clearMonth'\)/);
  assert.match(schedule, /t\('requestOff\.policy'\)/);
  assert.doesNotMatch(appBrowserTranslationSource(), /google\.translate|translate\.google|navigator\.language.*auto/i);
});

function appBrowserTranslationSource() {
  return [read('src/App.js'), read('src/core/i18n.js'), read('src/core/i18n.cjs')].join('\n');
}

test('17.0.26 restaurant-entered data stays raw while interface copy is translated', () => {
  const schedule = read('src/features/schedule.jsx');
  const operations = read('src/features/operations.jsx');
  assert.match(schedule, /role:\s*myNextShift\.role/);
  assert.match(schedule, /\{row\.reason\}/);
  assert.match(operations, /\{i\.text\}/);
  assert.match(operations, /\{n\.title\}/);
});
