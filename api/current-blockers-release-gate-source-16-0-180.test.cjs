'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const currentBlockerManifestPath = 'scripts/86chaos-release-gate/reported-current-blockers-20260814-050722.json';

function stableKey(row = {}) {
  return `${row.specPath || row.spec || ''}\u0000${row.fullSuitePath || ''}\u0000${row.leafTitle || row.exactTestTitle || row.title || ''}\u0000${row.project || (row.projects || [])[0] || ''}`;
}

function priorStatus(row = {}) {
  return String(row.priorStatus || '').toLowerCase();
}

test('current-blockers manifest reruns only the two remaining failed Ghost Request Off Play Store tests', () => {
  const manifest = json(currentBlockerManifestPath);
  assert.equal(manifest.mode, 'reported-current-blockers');
  assert.equal(manifest.source, 'uploaded-current-blockers-20260814-050722');
  assert.equal(manifest.totalSelected, 2);
  assert.equal(manifest.desktopSelected, 1);
  assert.equal(manifest.mobileSelected, 1);
  assert.equal(manifest.previousFailuresSelected, 2);
  assert.equal(manifest.previousTimeoutsSelected, 0);
  assert.equal(manifest.partialNotRunSelected, 0);
  assert.equal(manifest.baselineFullRunId, '2026-08-13T23-55-33');
  assert.equal(manifest.baselineSourceVersion, '16.0.179');
  assert.equal(manifest.baselineDeployedVersion, '16.0.179');
  const rows = manifest.selected || [];
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map(stableKey)).size, rows.length);
  assert.equal(rows.filter(row => row.project === 'chromium').length, 1);
  assert.equal(rows.filter(row => row.project === 'mobile-chromium').length, 1);
  assert.equal(rows.every(row => priorStatus(row) === 'failed'), true);
  assert.equal(rows.some(row => ['timedout', 'timeout', 'passed', 'skipped', 'notrun', 'not-run', 'not_run'].includes(priorStatus(row))), false);
  assert.equal(rows.every(row => /06-request-off-events-integration/.test(row.specPath || '') && /Ghost Mode Request Off/.test(row.leafTitle || '')), true);
  assert.equal(rows.some(row => /cost-regression/.test(row.specPath || '')), false, 'passed cost-regression identities must be absent');
  assert.equal(rows.some(row => /04-schedule-math-oracle|Schedule Builder/.test(`${row.specPath || ''} ${row.leafTitle || ''}`)), false, 'passed Schedule Builder identity must be absent');
});

test('current-blockers Play Store command is guarded to exactly two failed Ghost identities', () => {
  const pkg = json('package.json');
  const wrapper = read('RUN_86CHAOS_CURRENT_BLOCKERS_RELEASE_GATE.ps1');
  const prepare = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
  const config = read('playwright.failed-release.config.cjs');
  assert.equal(pkg.scripts['test:play-store:current-blockers'], 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_CURRENT_BLOCKERS_RELEASE_GATE.ps1');
  assert.match(wrapper, /SelectionMode reported-current-blockers/);
  assert.match(wrapper, /only the 2 current FAIL tests/);
  assert.match(wrapper, /cost-regression, Schedule Builder, and unrelated identities/);
  assert.match(prepare, /reported-current-blockers-20260814-050722\.json/);
  assert.match(prepare, /exactly 2/);
  assert.match(config, /reported-current-blockers runs only the 2 current FAIL identities/);
  assert.match(config, /expected 2 current blocker identities/);
  assert.match(config, /expected 1 chromium identity/);
  assert.match(config, /expected 1 mobile-chromium identity/);
  assert.match(config, /expected 0 timed-out identities/);
});

test('QA fixture keeps Allen partial Request Off separate from Sara conflict date', () => {
  const fixture = read('tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs');
  assert.match(fixture, /const preferredAllenPartialRequestDate = isoDate\(addDays\(weekStart, 5\)\)/);
  assert.match(fixture, /const allenPartialRequestDate = preferredAllenPartialRequestDate === tomorrowStr/);
  assert.match(fixture, /\? isoDate\(addDays\(today, 2\)\)/);
  assert.match(fixture, /date: allenPartialRequestDate, requestDate: allenPartialRequestDate/);
  assert.match(fixture, /userKey: 'sara'[\s\S]{0,220}date: tomorrowStr, requestDate: tomorrowStr/);
});

test('Ghost Request Off waits for ghost-list and validates fixture before conflict interaction', () => {
  const ghostTest = read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs');
  assert.match(ghostTest, /const ghostListResponsePromise = page\s*\.waitForResponse\(response => isTimeOffResponseAction\(response, 'ghost-list'\)/);
  assert.match(ghostTest, /await requestOffTab\.click\(\);\s*const ghostListResponse = await ghostListResponsePromise/);
  assert.match(ghostTest, /Ghost Mode Request Off should load the possessed employee records before date interaction/);
  assert.match(ghostTest, /ghostListResponse\.body\?\.action, 'Ghost Mode Request Off initialization response should be ghost-list'\)\.toBe\('ghost-list'\)/);
  assert.match(ghostTest, /const ownConflictDateRequest = \(Array\.isArray\(ghostListBody\?\.requests\) \? ghostListBody\.requests : \[\]\)\.find/);
  assert.match(ghostTest, /QA fixture must leave the Ghost conflict date free of Allen QA active Request Off records/);
});

test('Ghost Request Off privacy assertion is scoped to warning and conflict payload only', () => {
  const ghostTest = read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs');
  assert.match(ghostTest, /const conflictPrivacySurface = \[/);
  assert.match(ghostTest, /cancelWarning\.dialogMessage \|\| ''/);
  assert.match(ghostTest, /JSON\.stringify\(cancelWarning\.conflictRow \|\| \{\}\)/);
  assert.match(ghostTest, /Conflict warning and conflict response should not reveal private request reasons, emails, phone numbers, or full request documents/);
  assert.doesNotMatch(ghostTest, /expect\(text, 'Canceling the warning should not reveal private request reasons or email addresses'\)/);
  assert.match(ghostTest, /expect\(cancelWarning\.dialogMessage, 'Conflict warning must be shown before canceling date selection'\)\.toMatch/);
  assert.match(ghostTest, /if \(nativeDialog\) return \{ conflictDate, dialogMessage: nativeDialog\.message, accepted: accept, conflictRow \}/);
  assert.match(ghostTest, /return \{ conflictDate, dialogMessage: message, accepted: accept, conflictRow \}/);
});

test('Ghost Mode banner remains intact and workflow assertions stay authoritative', () => {
  const app = read('src/App.js');
  const ghostTest = read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs');
  assert.match(app, /Viewing user:/);
  assert.match(app, /Email:/);
  assert.match(ghostTest, /Conflict API response should include the seeded conflict date/);
  assert.match(ghostTest, /Seeded Sara Request Off should count as at least one other-employee conflict/);
  assert.match(ghostTest, /body\?\.action, 'Ghost Mode Request Off creation response should be specifically ghost-create'\)\.toBe\('ghost-create'\)/);
  assert.match(ghostTest, /page\.getByTestId\(`request-off-cancel-\$\{createdRequestId\}`\)/);
  assert.match(ghostTest, /isTimeOffResponseAction\(response, 'ghost-cancel'\)/);
  assert.match(ghostTest, /body\?\.action, 'Ghost Mode Request Off cancellation response should be specifically ghost-cancel'\)\.toBe\('ghost-cancel'\)/);
});
