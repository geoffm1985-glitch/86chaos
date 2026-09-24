'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.1.4 Schedule Builder control deck no longer overlays the editable grid', () => {
  const css = read('src/concept17.css');
  const assignmentSpec = read('tests/86chaos-new-implementations/09-schedule-builder-shift-assignment.spec.cjs');
  assert.match(css, /17\.1\.4 release-gate browser stability repair/);
  assert.match(css, /\.schedule-builder-control-deck\s*\{[\s\S]*?position:\s*relative !important;[\s\S]*?top:\s*auto !important;/);
  assert.match(css, /schedule-builder-cell[\s\S]*scroll-margin-top:\s*48px/);
  assert.match(assignmentSpec, /cells\.evaluateAll/);
  assert.doesNotMatch(assignmentSpec, /elementFromPoint/);
  assert.match(assignmentSpec, /scrollIntoViewIfNeeded/);
  assert.doesNotMatch(assignmentSpec, /force:\s*true/);
});

test('17.1.4 locale-independent route and subtab identities replace fragile English-only selectors', () => {
  const common = read('src/components/common.jsx');
  const schedule = read('src/features/schedule.jsx');
  const management = read('src/features/management.jsx');
  const spanishSpec = read('tests/86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs');
  const adminSpec = read('tests/86chaos-new-implementations/12-system-admin-subpages-back-navigation.spec.cjs');
  const fidelitySpec = read('tests/86chaos-new-implementations/19-concept1-complete-route-subtab-fidelity.spec.cjs');
  assert.match(common, /data-shell-route=\{tab\.id\}/);
  assert.match(schedule, /data-concept-subtab-button=\{tab\}/);
  assert.match(management, /data-concept-subtab-button=\{tab\.id\}/);
  assert.match(management, /data-concept-subtab-button=\{`labor-\$\{id\}`\}/);
  assert.match(spanishSpec, /creds\('MANAGER'\)/);
  assert.match(spanishSpec, /drawer\.locator\('\[data-shell-route="published"\]'\)/);
  assert.match(adminSpec, /\[data-shell-route="godmode"\]/);
  assert.match(fidelitySpec, /STABLE_SUBTAB_IDS/);
  assert.match(fidelitySpec, /data-concept-subtab-button/);
});

test('17.1.4 deployed version assertion follows package.json instead of retired 17.1.0 text', () => {
  const spec = read('tests/86chaos-new-implementations/10-app-bootstrap-i18n-runtime.spec.cjs');
  assert.match(spec, /version: expectedVersion/);
  assert.match(spec, /new RegExp\(`Version \$\{escapedVersion\}`/);
  assert.doesNotMatch(spec, /Version 17\\\.1\\\.0/);
});

test('17.1.4 86Voice shares the narrow-phone bottom-nav baseline and Kitchen assertion remains locale-safe', () => {
  const css = read('src/concept17.css');
  const spec = read('tests/86chaos-new-implementations/20-mobile-workflow-repair.spec.cjs');
  assert.match(css, /@media \(max-width: 420px\)[\s\S]*?voice-command-dock\.fixed\.bottom-5\.left-4[\s\S]*?bottom:\s*max\(5px, env\(safe-area-inset-bottom, 0px\)\) !important/);
  assert.match(spec, /Centro de Mando de Cocina/);
  assert.match(spec, /formatFullDate is not defined\|This section hit a snag/);
});

test('17.1.4 long route sweeps use evidence-based timeout budgets instead of failing healthy coverage at 150 seconds', () => {
  const deep = read('tests/86chaos-new-implementations/18-app-wide-deep-route-layout.spec.cjs');
  const fidelity = read('tests/86chaos-new-implementations/19-concept1-complete-route-subtab-fidelity.spec.cjs');
  assert.match(deep, /test\.setTimeout\(240000\)/);
  assert.ok((fidelity.match(/test\.setTimeout\(240000\)/g) || []).length >= 3);
});
