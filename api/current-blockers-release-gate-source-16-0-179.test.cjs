'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const currentBlockerManifestPath = 'scripts/86chaos-release-gate/reported-current-blockers-20260814-042542.json';

function stableKey(row = {}) {
  return `${row.specPath || row.spec || ''}\u0000${row.fullSuitePath || ''}\u0000${row.leafTitle || row.exactTestTitle || row.title || ''}\u0000${row.project || (row.projects || [])[0] || ''}`;
}

test('current-blockers manifest reruns only the four latest failed or timed-out Play Store tests', () => {
  const manifest = json(currentBlockerManifestPath);
  assert.equal(manifest.mode, 'reported-current-blockers');
  assert.equal(manifest.totalSelected, 4);
  assert.equal(manifest.desktopSelected, 2);
  assert.equal(manifest.mobileSelected, 2);
  assert.equal(manifest.previousFailuresSelected, 2);
  assert.equal(manifest.previousTimeoutsSelected, 2);
  assert.equal(manifest.partialNotRunSelected, 0);
  const rows = manifest.selected || [];
  assert.equal(rows.length, 4);
  assert.equal(new Set(rows.map(stableKey)).size, rows.length);
  assert.equal(rows.filter(row => String(row.priorStatus || '').toLowerCase() === 'failed').length, 2);
  assert.equal(rows.filter(row => ['timedout', 'timeout'].includes(String(row.priorStatus || '').toLowerCase())).length, 2);
  assert.equal(rows.some(row => /04-schedule-math-oracle/.test(row.specPath || '')), false, 'passed mobile Schedule Builder identity must be absent');
  assert.equal(rows.filter(row => /06-request-off-events-integration/.test(row.specPath || '')).length, 2);
  assert.equal(rows.filter(row => /cost-regression/.test(row.specPath || '')).length, 2);
  assert.equal(rows.some(row => ['passed', 'skipped', 'notrun', 'not-run', 'not_run'].includes(String(row.priorStatus || '').toLowerCase())), false);
});

test('current-blockers Play Store command is guarded and excludes passed skipped and not-run tests', () => {
  const pkg = json('package.json');
  const wrapper = read('RUN_86CHAOS_CURRENT_BLOCKERS_RELEASE_GATE.ps1');
  const prepare = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
  const config = read('playwright.failed-release.config.cjs');
  assert.equal(pkg.scripts['test:play-store:current-blockers'], 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_CURRENT_BLOCKERS_RELEASE_GATE.ps1');
  assert.match(wrapper, /SelectionMode reported-current-blockers/);
  assert.match(wrapper, /only the 4 current FAIL\/TIMEOUT tests/);
  assert.match(wrapper, /mobile Schedule Builder identity that passed/);
  assert.match(prepare, /reported-current-blockers-20260814-042542\.json/);
  assert.match(prepare, /exactly 4/);
  assert.match(config, /reported-current-blockers runs only the 4 current FAIL\/TIMEOUT identities/);
  assert.match(config, /expected 4 current blocker identities/);
});

test('cost regression uses unique current-workspace hook without broad close fallback', () => {
  const cost = read('tests/e2e/cost-regression.spec.cjs');
  assert.match(cost, /dialog\.getByTestId\('workspace-switcher-current-workspace'\)/);
  assert.match(cost, /current workspace control should be uniquely exposed inside the workspace switcher/);
  assert.match(cost, /selecting the current workspace should close the workspace switcher/);
  assert.doesNotMatch(cost, /getByRole\('button', \{ name: \/close\/i \}\)/);
  assert.doesNotMatch(cost, /current\.click\(\)\.catch/);
});

test('Ghost Request Off handles native dialogs before response and DOM inspection', () => {
  const ghostTest = read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs');
  assert.match(ghostTest, /waitForEvent\('dialog', \{ timeout: 6000 \}\)\s*\.then\(async dialog =>/);
  assert.match(ghostTest, /if \(accept\) await dialog\.accept\(\);\s*else await dialog\.dismiss\(\);/);
  assert.match(ghostTest, /const \[conflictResponse, nativeDialog\] = await Promise\.all/);
  assert.match(ghostTest, /try \{ conflictBody = conflictResponse \? await conflictResponse\.json\(\) : null; \}/);
  assert.match(ghostTest, /if \(nativeDialog\) return \{ conflictDate, dialogMessage: nativeDialog\.message, accepted: accept \};/);
});

test('Request Off cancellation is accessible and targets the created Ghost request id', () => {
  const schedule = read('src/features/schedule.jsx');
  const ghostTest = read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs');
  assert.match(schedule, /type="button" data-testid=\{`request-off-cancel-\$\{r\.id\}`\}/);
  assert.match(schedule, /aria-label=\{`Cancel Request Off for \$\{formatRequestDateLabel\(r\.date\)\}`\}/);
  assert.match(schedule, /title=\{`Cancel Request Off for \$\{formatRequestDateLabel\(r\.date\)\}`\}/);
  assert.match(ghostTest, /body\?\.action, 'Ghost Mode Request Off creation response should be specifically ghost-create'\)\.toBe\('ghost-create'\)/);
  assert.match(ghostTest, /const createdRequestId = createResponse\?\.body\?\.requestIds\?\.\[0\]/);
  assert.match(ghostTest, /page\.getByTestId\(`request-off-cancel-\$\{createdRequestId\}`\)/);
  assert.match(ghostTest, /waitForEvent\('dialog', \{ timeout: 5000 \}\)\s*\.then\(async dialog =>/);
  assert.match(ghostTest, /await dialog\.accept\(\);/);
  assert.match(ghostTest, /isTimeOffResponseAction\(response, 'ghost-cancel'\)/);
  assert.match(ghostTest, /body\?\.action, 'Ghost Mode Request Off cancellation response should be specifically ghost-cancel'\)\.toBe\('ghost-cancel'\)/);
});
