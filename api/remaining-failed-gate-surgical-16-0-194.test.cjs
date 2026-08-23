'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('exhaustive UI helper probes safe controls without mutating its own state and can reveal collapsed admin directory', () => {
  const helper = read('tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');
  assert.match(helper, /safe-actionability-trial/);
  assert.match(helper, /click\(\{ trial: true, timeout: 3000 \}\)/);
  assert.doesNotMatch(helper, /action: 'safe-click'/);
  assert.match(helper, /\^Show directory\$/i);
  assert.match(helper, /return findStateControl\(page, label, \{ allowDirectoryReveal: false \}\)/);
});

test('surface matrix models only reachable current nested states', () => {
  const matrix = read('tests/86chaos-release-gate/exhaustive-surface-matrix.cjs');
  assert.match(matrix, /\['Open Copilot Tools', 'Coverage'\]/);
  assert.match(matrix, /\['Open Copilot Tools', 'Templates'\]/);
  assert.match(matrix, /\['My Schedule', 'Trade Board'\]/);
  assert.doesNotMatch(matrix, /prep:\s*\[\[\/\^prep\$\/i\]/);
  assert.match(matrix, /\['QuickBooks'\]/);
});

test('staff route matrix preserves intended personal Settings access', () => {
  const matrix = read('scripts/86chaos-release-gate/route-access-matrix.cjs');
  const staff = matrix.match(/staff:\s*\[([^\]]+)\]/s)?.[1] || '';
  assert.match(staff, /'settings'/);
  assert.match(staff, /'hr-training'/);
});

test('Document Vault E2E waits for selected file binding and successful file upload before persistence credit', () => {
  const spec = read('tests/86chaos-full-audit/13-back-office-document-vault.spec.cjs');
  assert.match(spec, /Document Vault must finish binding the selected File into React state before Save is dispatched/);
  assert.match(spec, /Document Vault file upload must complete successfully before persistence is credited/);
  assert.match(spec, /Document Uploaded/);
  assert.match(spec, /Preview \/ Download/);
});

test('Schedule Request Off warning waits for both roster and seeded Request Off hydration', () => {
  const spec = read('tests/e2e/schedule-request-off-management.spec.cjs');
  const target = spec.split("test('Schedule Builder requested-off warning shows employee name and never Someone'")[1] || '';
  assert.match(target, /getByText\('Allen QA', \{ exact: true \}\)/);
  assert.match(target, /\[title\^="Requested off:"\]/);
  assert.match(target, /Seeded Request Off conflict should identify the actual employee/);
});

test('reported responsive and accessibility defects are fixed without weakening the release assertions', () => {
  const schedule = read('src/features/schedule.jsx');
  const inventory = read('src/features/inventory.jsx');
  const operations = read('src/features/operations.jsx');
  const css = read('src/styles.css');
  const responsive = read('tests/86chaos-release-gate/31-exhaustive-responsive-nested-layout.spec.cjs');
  const accessibility = read('tests/86chaos-release-gate/32-exhaustive-nested-accessibility.spec.cjs');
  assert.match(schedule, /aria-label="Full schedule shift list"/);
  assert.match(schedule, /aria-label=\{`Shifts for \$\{formatDisplayDate\(date\)\}`\}/);
  assert.match(schedule, /schedule-builder-event-chip[^"\n]*min-w-\[42px\][^"\n]*min-h-\[42px\]/);
  assert.match(schedule, /schedule-builder-time-chip[^`\n]*min-w-\[42px\][^`\n]*min-h-\[42px\]/);
  assert.match(schedule, /bg-\[#0B0E11\] text-slate-100 border-\[#1F2933\]/);
  assert.match(inventory, /bg-red-500\/20 text-red-300/);
  assert.match(operations, /if \(u === 'Critical'\) return 'text-red-200 font-black'/);
  assert.match(operations, /brief-quick-action min-h-\[42px\]/);
  assert.match(operations, /w-11 h-11 rounded-lg/);
  assert.match(css, /\.maintenance-record-action-button[\s\S]*min-width: 42px !important;[\s\S]*min-height: 42px !important;/);
  assert.match(responsive, /expect\(small,'Touch\/mobile states must meet the app tap-target policy'\)\.toEqual\(\[\]\)/);
  assert.match(accessibility, /expect\(blocking,[\s\S]*?\)\.toEqual\(\[\]\)/);
});
