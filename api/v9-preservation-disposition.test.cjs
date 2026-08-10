'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('V9 preservation tool is formally retired when no authoritative baseline ships', () => {
  assert.equal(fs.existsSync(path.join(root, 'V9_BASELINE_TEST_MANIFEST.json')), false);
  const tool = read('test-tools/validate-v9-preservation.cjs');
  const doc = read('test-tools/V9_PRESERVATION_DISPOSITION.md');
  assert.match(tool, /retired:\s*true/);
  assert.match(tool, /No authoritative V9_BASELINE_TEST_MANIFEST\.json/);
  assert.match(doc, /retired from the current distributed regression pack/i);
  assert.match(doc, /Do not fabricate/i);
});
