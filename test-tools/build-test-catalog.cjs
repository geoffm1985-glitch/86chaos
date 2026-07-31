#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = process.cwd();
const runDir = process.env.CHAOS_RELEASE_GATE_RUN_DIR || path.join(root, 'test-results');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(?:spec|test)\.(?:cjs|mjs|js|jsx|ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function framework(file) {
  const r = rel(file);
  if (r.startsWith('api/') || r.endsWith('.test.cjs') && !r.startsWith('src/')) return 'node';
  if (r.startsWith('src/')) return 'jest';
  return 'playwright';
}
function titles(file) {
  const text = fs.readFileSync(file, 'utf8');
  const rows = [];
  for (const match of text.matchAll(/\b(?:test|it)\s*\(\s*(["'`])([\s\S]*?)\1/g)) {
    const title = match[2].replace(/\s+/g, ' ').trim();
    if (title && !title.includes('${')) rows.push(title);
  }
  return rows;
}

const files = walk(path.join(root, 'tests')).concat(walk(path.join(root, 'src'))).concat(walk(path.join(root, 'api')))
  .filter((file, index, all) => all.indexOf(file) === index).sort();
const catalog = files.map(file => ({ file: rel(file), framework: framework(file), staticTitles: titles(file) }));
const totals = catalog.reduce((acc, row) => {
  acc.files += 1;
  acc.tests += row.staticTitles.length;
  acc[row.framework] = (acc[row.framework] || 0) + row.staticTitles.length;
  return acc;
}, { files: 0, tests: 0, playwright: 0, jest: 0, node: 0 });
const payload = { generatedAt: new Date().toISOString(), totals, files: catalog };
fs.mkdirSync(runDir, { recursive: true });
fs.writeFileSync(path.join(runDir, 'ultimate-test-catalog.json'), JSON.stringify(payload, null, 2));
const lines = ['# 86 Chaos Ultimate Test Catalog', '', `Generated: ${payload.generatedAt}`, '', `- Test files: ${totals.files}`, `- Static named tests: ${totals.tests}`, `- Playwright: ${totals.playwright}`, `- Jest: ${totals.jest}`, `- Node: ${totals.node}`, '', 'Dynamically generated route, API, role, viewport, and inventory cases are counted by the runtime reporters.', ''];
for (const row of catalog) {
  lines.push(`## ${row.file} (${row.framework})`);
  for (const title of row.staticTitles) lines.push(`- ${title}`);
  if (!row.staticTitles.length) lines.push('- Dynamic test generation or helper-only file');
  lines.push('');
}
fs.writeFileSync(path.join(runDir, 'ultimate-test-catalog.md'), lines.join('\n'));
console.log(JSON.stringify({ ok: true, output: path.join(runDir, 'ultimate-test-catalog.json'), totals }, null, 2));
