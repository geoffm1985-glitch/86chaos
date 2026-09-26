'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

test('17.0.33 keeps 17.0.29 feature-line capabilities', () => {
  const schedule = read('src/features/schedule.jsx');
  const app = read('src/App.js');
  const pkg = json('package.json');
  assert.equal(pkg.version, '17.0.33');
  assert.match(app, /I18nProvider/);
  assert.match(schedule, /useI18n/);
  assert.match(schedule, /schedule-shift-assign/);
  assert.match(schedule, /schedule-shift-delete/);
  assert.match(schedule, /createSchedulePublishGuard/);
  assert.match(schedule, /normalizeTimeOffPolicy/);
  assert.ok(fs.existsSync(path.join(root, 'api', '_pos-bridge-route.js')));
  assert.ok(fs.existsSync(path.join(root, 'api', 'schedule-publish.js')));
  assert.ok(fs.existsSync(path.join(root, 'src', 'core', 'i18n.js')));
});

test('17.0.33 carries forward 16.0.244 safety and release-gate repairs', () => {
  const runner = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
  const mutation = read('scripts/86chaos-release-gate/mutation-safety.cjs');
  const targets = read('scripts/86chaos-release-gate/vercel-targets.cjs');
  const universe = read('scripts/86chaos-release-gate/release-test-universe.cjs');
  const appCore = read('src/core/appCore.js');
  assert.match(runner, /Initialize-AutoProvisionRoleAccounts/);
  assert.match(runner, /RandomNumberGenerator/);
  assert.match(mutation, /testing\.86chaos\.com/);
  assert.match(mutation, /experimental\.86chaos\.com/);
  assert.match(targets, /APPROVED_NON_PRODUCTION_ALIASES/);
  assert.match(appCore, /testing\.86chaos\.com/);
  assert.match(appCore, /experimental\.86chaos\.com/);
  for (const n of [37,38,39,40,41,42]) assert.match(universe, new RegExp(`tests/86chaos-release-gate/${n}-`));
  assert.ok(fs.existsSync(path.join(root, 'api', 'native-backup-watchdog-timeout-hardening.test.cjs')));
  assert.ok(fs.existsSync(path.join(root, 'api', 'source-validator-line-ending-safety.test.cjs')));
  assert.ok(fs.existsSync(path.join(root, 'api', 'release-gate-auto-provision-role-env.test.cjs')));
});

test('17.0.33 schedule PDF combines compact month view and lossless dense overflow', () => {
  const model = read('src/core/schedulePrintModel.js');
  const pdf = read('src/core/schedulePdf.js');
  assert.match(model, /formatScheduleTime12Hour/);
  assert.match(model, /detailLabel/);
  assert.match(pdf, /candidateSizes = \[8, 7\.5, 7, MIN_FONT_SIZE\]/);
  assert.match(pdf, /detailCells/);
  assert.match(pdf, /detail page/);
  assert.match(pdf, /shift\.detailLabel/);
  assert.doesNotMatch(pdf, /cannot fit all .* shifts/);
});
