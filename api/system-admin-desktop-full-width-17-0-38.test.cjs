'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.38 removes the obsolete 232px System Administrator desktop navigation rail from the live one-child layout', () => {
  const css = read('src/styles.css');
  const marker = css.indexOf('17.0.38 desktop width repair');
  assert.ok(marker >= 0, '17.0.38 desktop width repair marker exists');
  const repair = css.slice(marker, marker + 1800);
  assert.match(repair, /\.admin46-shell \.admin46-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) !important/);
  assert.match(repair, /\.admin46-shell \.admin46-content\s*\{[\s\S]*grid-column:\s*1 \/ -1 !important/);
  assert.match(repair, /\.admin46-shell \.admin46-content\s*\{[\s\S]*width:\s*100% !important/);
});

test('17.0.38 preserves the Concept 1 desktop two-two-three card hierarchy after the full-width shell repair', () => {
  const source = read('src/features/management.jsx');
  const css = read('src/styles.css');
  assert.match(source, /admin37-featured-grid admin37-featured-grid-primary/);
  assert.match(source, /admin37-featured-grid admin37-featured-grid-secondary/);
  assert.match(css, /admin37-featured-grid-primary[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0,1fr\)\)/);
  assert.match(css, /admin37-featured-grid-secondary[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0,1fr\)\)/);
});
