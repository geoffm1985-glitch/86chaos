'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.1.5 mobile bottom toolbar labels are explicitly single-line and Android-safe', () => {
  const css = read('src/concept17.css');
  const shell = read('src/components/concept17.jsx');
  assert.match(css, /17\.1\.5 mobile bottom-nav single-line label repair/);
  assert.match(css, /\.concept17-mobile-nav-label,[\s\S]*?white-space:\s*nowrap !important;/);
  assert.match(css, /word-break:\s*keep-all !important;/);
  assert.match(css, /overflow-wrap:\s*normal !important;/);
  assert.match(css, /@media \(max-width: 420px\)[\s\S]*?\.concept17-mobile-nav-label,[\s\S]*?font-size:\s*7px !important;/);
  assert.match(css, /-webkit-text-size-adjust:\s*100%/);
  assert.ok((shell.match(/className="concept17-mobile-nav-label"/g) || []).length >= 2);
});

test('17.1.5 preserves single-line labels in the approved five-slot mobile command bar', () => {
  const css = read('src/concept17.css');
  const shell = read('src/components/concept17.jsx');
  assert.match(css, /17\.1\.13 approved-reference full-app visual parity pass[\s\S]*grid-template-columns:\s*repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(shell, /data-testid="concept17-mobile-voice-button"/);
  assert.match(shell, /items\.slice\(0, 4\)/);
  assert.match(shell, /concept17-mobile-nav-label/);
});
