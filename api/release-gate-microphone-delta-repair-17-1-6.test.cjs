'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.1.6 starts 86Voice recognition directly from the user microphone gesture', () => {
  const common = read('src/components/common.jsx');
  const openDock = common.match(/const openDock = \(\) => \{([\s\S]*?)\n  \};\n\n  const parseCommand/);
  assert.ok(openDock, 'openDock implementation should be present');
  assert.match(openDock[1], /startListening\(\{ autoStart: true, fromUserGesture: true \}\)/);
  assert.doesNotMatch(openDock[1], /setTimeout|pendingVoiceStartTimerRef\.current\s*=/);
  assert.match(common, /onClick=\{open \? closeDock : openDock\}/);
});

test('17.1.6 Spanish mobile regression targets the visible translated route instead of a hidden desktop duplicate', () => {
  const spec = read('tests/86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs');
  assert.match(spec, /\[data-route-frame="today"\]:visible/);
  assert.match(spec, /\[data-shell-route="today"\]:visible/);
  assert.match(spec, /toContainText\(\/Inicio\/i\)/);
  assert.match(spec, /todayFrame\.getByText\(\/Resumen del gerente\|Resumen de cocina/);
});

test('17.1.6 Schedule Builder desktop controls cannot overlap Assign', () => {
  const css = read('src/concept17.css');
  const spec = read('tests/86chaos-new-implementations/09-schedule-builder-shift-assignment.spec.cjs');
  assert.match(css, /17\.1\.6 release-gate \+ microphone repair/);
  assert.match(css, /@media \(min-width: 721px\) and \(max-width: 1599px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important;/);
  assert.match(css, /schedule-builder-assign-button[\s\S]*?scroll-margin-top:\s*112px !important;/);
  assert.match(spec, /cells\.evaluateAll/);
  assert.doesNotMatch(spec, /for \(let i = 0; i < count; i \+= 1\)/);
  assert.doesNotMatch(spec, /document\.elementFromPoint/);
});

test('17.1.6 keeps 17.1.5 single-line mobile toolbar protections intact', () => {
  const css = read('src/concept17.css');
  const shell = read('src/components/concept17.jsx');
  assert.match(css, /white-space:\s*nowrap !important/);
  assert.match(css, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(shell, /concept17-mobile-nav-voice-slot/);
});
