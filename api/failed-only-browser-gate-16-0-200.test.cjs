'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

const helper = read('tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');
const matrixSource = read('tests/86chaos-release-gate/exhaustive-surface-matrix.cjs');
const { ROUTE_STATES } = require('../tests/86chaos-release-gate/exhaustive-surface-matrix.cjs');
const operations = read('src/features/operations.jsx');
const management = read('src/features/management.jsx');
const styles = read('src/styles.css');

test('16.0.200 probes Branding color controls with deterministic structural descriptors', () => {
  assert.match(helper, /else if \(type === 'color'\) sample = '#123456';/);
  assert.doesNotMatch(helper, /byLabel\.or\(/);
  assert.match(helper, /structuralKey/);
  assert.match(helper, /selectorOrdinal/);
  assert.match(helper, /\.nth\(Number\(row\.selectorOrdinal \|\| 0\)\)/);
  assert.doesNotMatch(helper, /hidden\|file\|password\|color/i);
  assert.match(helper, /restoreAndObserve\(page, locatorFromFormDescriptor\(page, row\), before/);
});

test('16.0.200 state discovery rejects hidden controls without requiring geometry before scroll', () => {
  assert.match(helper, /const STATE_INTERACTIVE_SELECTOR = 'button, a, \[role="button"\], \[role="tab"\], \[role="menuitem"\]';/);
  const stateControlBody = helper.match(/async function stateControlIndexes[\s\S]*?\n}\n\nasync function findStateControl/)?.[0] || '';
  assert.match(stateControlBody, /el\.hidden \|\| el\.getAttribute\('aria-hidden'\) === 'true'/);
  assert.match(stateControlBody, /style\.visibility === 'hidden' \|\| style\.display === 'none'/);
  assert.doesNotMatch(stateControlBody, /rect\.width > 0 && rect\.height > 0/);
  const alreadyVisibleBody = helper.slice(helper.indexOf('async function stateLabelAlreadyVisible'), helper.indexOf('async function applyStatePath'));
  assert.doesNotMatch(alreadyVisibleBody, /bodyText\(/);
  assert.doesNotMatch(alreadyVisibleBody, /\\b\(\?:Open\\s\+\)\?/);
  assert.match(alreadyVisibleBody, /aria-selected/);
  assert.match(alreadyVisibleBody, /aria-current/);
  assert.match(alreadyVisibleBody, /h1, h2, h3, h4, h5, h6/);
});

test('16.0.200 keeps Schedule Builder states but moves Open Copilot Tools before launcher-consuming states', () => {
  const schedule = ROUTE_STATES.schedule.map(pathParts => pathParts.map(part => String(part)).join(' > '));
  assert.equal(schedule[0], 'Schedule Builder');
  assert.equal(schedule[1], 'Schedule Builder > Open Copilot Tools');
  for (const expected of [
    'Schedule Builder > Coverage',
    'Schedule Builder > Templates',
    'Schedule Builder > /Create Template|Edit Template/i',
    'Schedule Builder > Drag Board',
    'Schedule Builder > Warnings',
    'Schedule Builder > Edit Presets',
    'Schedule Builder > Auto-Fill',
    'Schedule Builder > /^Event$/i',
  ]) {
    assert.ok(schedule.includes(expected), `missing ${expected}`);
  }
  assert.match(matrixSource, /\['Schedule Builder', 'Open Copilot Tools'\],[\s\S]*\['Schedule Builder', 'Coverage'\]/);
});

test('16.0.200 preserves the real QuickBooks Back Office state and button', () => {
  assert.ok(ROUTE_STATES['back-office'].some(pathParts => pathParts[0] === 'QuickBooks'));
  assert.match(management, /\["quickbooks","QuickBooks"\]/);
  assert.match(management, /aria-label=\{label\}/);
  assert.match(management, /title=\{label\}/);
});

test('16.0.200 uses existing Preventative Maintenance mobile tap-target utility only on PM edit/delete controls', () => {
  const pmLine = operations.split('\n').find(line => line.includes('Delete this preventative schedule?')) || '';
  assert.match(pmLine, /maintenance-record-action-button w-9 h-9/);
  assert.equal((pmLine.match(/maintenance-record-action-button w-9 h-9/g) || []).length, 2);
  assert.match(styles, /\.maintenance-record-action-button \{[\s\S]*width: 42px !important;[\s\S]*height: 42px !important;/);
  assert.match(styles, /@media \(min-width: 640px\) \{[\s\S]*\.maintenance-record-action-button \{[\s\S]*width: 32px !important;[\s\S]*height: 32px !important;/);
});

test('16.0.200 bundles exactly the five authoritative failed-only identities', () => {
  const manifest = json('scripts/86chaos-release-gate/reported-failed-only-20260825-230842.json');
  assert.equal(manifest.targetRunId, '2026-08-25T23-08-42');
  assert.equal(manifest.targetSourceVersion, '16.0.199');
  assert.equal(manifest.targetDeployedVersion, '16.0.199');
  assert.equal(manifest.totalSelected, 5);
  assert.equal(manifest.desktopSelected, 3);
  assert.equal(manifest.mobileSelected, 2);
  assert.equal(manifest.previousFailuresSelected, 4);
  assert.equal(manifest.previousTimeoutsSelected, 1);
  assert.equal(manifest.previousPassesSelected, 0);
  assert.equal(manifest.previousSkipsSelected, 0);
  assert.equal(manifest.notRunSelected, 0);
  assert.equal(manifest.selected.length, 5);
  assert.deepEqual(manifest.selected.map(row => `${row.project}|${row.specPath}`).sort(), [
    'chromium|86chaos-release-gate/28-exhaustive-route-state-control-graph.spec.cjs',
    'chromium|86chaos-release-gate/31-exhaustive-responsive-nested-layout.spec.cjs',
    'chromium|86chaos-release-gate/32-exhaustive-nested-accessibility.spec.cjs',
    'mobile-chromium|86chaos-release-gate/28-exhaustive-route-state-control-graph.spec.cjs',
    'mobile-chromium|86chaos-release-gate/32-exhaustive-nested-accessibility.spec.cjs',
  ].sort());
  assert.equal(manifest.selected.filter(row => row.priorStatus === 'failed').length, 4);
  assert.equal(manifest.selected.filter(row => row.priorStatus === 'timedout').length, 1);
});


test('16.0.200 marks already-open Schedule Copilot and active Back Office tabs as structural current-state evidence', () => {
  const schedule = read('src/features/schedule.jsx');
  const managementSource = read('src/features/management.jsx');
  assert.match(schedule, /schedule-copilot-compact[\s\S]*aria-label="Open Copilot Tools"[\s\S]*data-chaos-current-state="true"/);
  assert.match(schedule, /aria-selected=\{activeTool===id\}/);
  assert.match(schedule, /data-chaos-current-state=\{activeTool===id \? 'true' : undefined\}/);
  assert.match(managementSource, /role="tab" aria-label=\{label\} title=\{label\} aria-selected=\{subTab === id\}/);
  assert.match(managementSource, /data-chaos-current-state=\{subTab === id \? 'true' : undefined\}/);
});

test('16.0.200 release runner resolves stale target env values instead of failing before browsers execute', () => {
  const runner = read('RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1');
  assert.match(runner, /function Resolve-ReleaseTargets/);
  assert.match(runner, /Read-PackageVersion/);
  assert.match(runner, /canonical testing Preview URL/);
  assert.match(runner, /Resolved stale \$key target/);
  assert.doesNotMatch(runner, /Assert-NoReleaseTargetConflicts \$EnvTestLocal \$EnvLocal/);
});
