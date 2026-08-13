'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('printed month calendar uses compact shift rows instead of clipping high-staffing days', () => {
  for (const file of ['src/features/schedule.jsx', 'src/components/TabMonth.js']) {
    const source = read(file);
    assert.match(source, /print-shift-stack/);
    assert.match(source, /overflow:\s*visible\s*!important/);
    assert.match(source, /print-day-dense/);
    assert.match(source, /dayShifts\.length\s*>=\s*6/);
    assert.match(source, /font-size:\s*7px\s*!important/);
    assert.match(source, /line-height:\s*1\s*!important/);
  }
});

test('printed schedule month view keeps full labels available on paper', () => {
  const source = read('src/features/schedule.jsx');
  assert.match(source, /<span className="hidden sm:inline">\{labels\.full\}<\/span>/);
  assert.match(source, /\[class~="hidden"\]\[class~="sm:inline"\]\s*\{\s*display:\s*inline\s*!important;\s*\}/);
  assert.match(source, /\[class~="sm:hidden"\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
});
