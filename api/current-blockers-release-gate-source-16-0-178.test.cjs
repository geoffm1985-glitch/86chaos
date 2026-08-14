'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

test('current-blockers manifest reruns only the five latest failed or timed-out Play Store tests', () => {
  const manifest = json('scripts/86chaos-release-gate/reported-current-blockers-20260814-033828.json');
  assert.equal(manifest.mode, 'reported-current-blockers');
  assert.equal(manifest.totalSelected, 5);
  assert.equal(manifest.desktopSelected, 2);
  assert.equal(manifest.mobileSelected, 3);
  assert.equal(manifest.previousFailuresSelected, 1);
  assert.equal(manifest.previousTimeoutsSelected, 4);
  assert.equal(manifest.partialNotRunSelected, 0);
  const rows = manifest.selected || [];
  assert.equal(rows.length, 5);
  assert.equal(rows.filter(row => String(row.priorStatus || '').toLowerCase() === 'failed').length, 1);
  assert.equal(rows.filter(row => ['timedout', 'timeout'].includes(String(row.priorStatus || '').toLowerCase())).length, 4);
  assert.equal(rows.some(row => /04-schedule-math-oracle/.test(row.specPath || '') && row.project === 'mobile-chromium'), true);
  assert.equal(rows.filter(row => /06-request-off-events-integration/.test(row.specPath || '')).length, 2);
  assert.equal(rows.filter(row => /cost-regression/.test(row.specPath || '')).length, 2);
  assert.equal(rows.some(row => ['passed', 'skipped', 'notrun', 'not-run', 'not_run'].includes(String(row.priorStatus || '').toLowerCase())), false);
});

test('current-blockers Play Store command is guarded and excludes passed/skipped tests', () => {
  const pkg = json('package.json');
  const wrapper = read('RUN_86CHAOS_CURRENT_BLOCKERS_RELEASE_GATE.ps1');
  const prepare = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
  const config = read('playwright.failed-release.config.cjs');
  assert.equal(pkg.scripts['test:play-store:current-blockers'], 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_CURRENT_BLOCKERS_RELEASE_GATE.ps1');
  assert.match(wrapper, /SelectionMode reported-current-blockers/);
  assert.match(prepare, /reported-current-blockers/);
  assert.match(prepare, /exactly 5/);
  assert.match(config, /reported-current-blockers runs only the 5 current FAIL\/TIMEOUT identities/);
  assert.match(config, /expected 5 current blocker identities/);
});

test('Schedule route and mobile seed visibility are hardened without hiding Schedule Builder evidence', () => {
  const app = read('src/App.js');
  const scheduleTest = read('tests/86chaos-full-audit/04-schedule-math-oracle.spec.cjs');
  assert.match(app, /if \(normalized === 'schedule'\) return 'schedule-builder'/);
  assert.match(app, /setActiveScheduleSubTab\('schedule-builder'\)/);
  assert.match(scheduleTest, /expect\.poll/);
  assert.match(scheduleTest, /Schedule Builder should hydrate current-run QA staff\/events/);
  assert.match(scheduleTest, /Invalid seeded 10p-3p shift should be visibly flagged/);
});

test('Ghost Request Off conflict lookup supports legacy workspace/date rows and target listing', () => {
  const api = read('api/time-off-request.js');
  const apiTest = read('api/time-off-request.test.cjs');
  assert.match(api, /function requestDateKey/);
  assert.match(api, /requestDate/);
  assert.match(api, /where\('workspaceId', '==', restaurantId\)/);
  assert.match(api, /listTargetRequests/);
  assert.match(apiTest, /Ghost Mode conflict lookup finds legacy workspace\/date rows for other employees/);
  assert.match(apiTest, /Ghost Mode list returns target Request Off rows stored under legacy schedule identity/);
});

test('cost regression workspace switcher is scoped to the dialog and current workspace marker', () => {
  const app = read('src/App.js');
  const cost = read('tests/e2e/cost-regression.spec.cjs');
  assert.match(app, /data-testid=\{selected \? 'workspace-switcher-current-workspace'/);
  assert.match(app, /data-current-workspace=\{selected \? 'true' : 'false'\}/);
  assert.match(cost, /getByRole\('dialog', \{ name: \/switch workspace\/i \}\)/);
  assert.match(cost, /workspace-switcher-current-workspace/);
  assert.doesNotMatch(cost, /page\.getByRole\('button', \{ name: \/current\|active workspace\|switch\/i \}\)\.first\(\)/);
});
