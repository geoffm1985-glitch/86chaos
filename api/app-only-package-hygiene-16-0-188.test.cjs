'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const forbiddenNames = new Set(['node_modules', 'build', 'coverage', '.git', '86chaos-play-store-release-gate', '__pycache__']);
const forbiddenFiles = new Set(['.last-run.json', '.env', '.env.local', '.env.test.local']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    const rel = path.relative(root, p).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (forbiddenNames.has(entry.name)) out.push(rel);
      else walk(p, out);
    } else if (forbiddenFiles.has(entry.name) || entry.name.endsWith('.pyc')) {
      out.push(rel);
    }
  }
  return out;
}

test('app-only hygiene rejects forbidden source-controlled artifacts and local secrets', () => {
  const offenders = walk(root).filter(rel => !rel.startsWith('docs/') && !rel.startsWith('.') && !rel.startsWith('test-results/') && !rel.startsWith('scripts/python/__pycache__'));
  assert.deepEqual(offenders, []);
});

test('source inventory excludes generated release-gate results from package scans', () => {
  const inventory = fs.readFileSync(path.join(root, 'scripts/86chaos-release-gate/source-inventory.cjs'), 'utf8');
  assert.match(inventory, /test-results/);
  assert.match(inventory, /node_modules/);
  assert.match(inventory, /build/);
});
