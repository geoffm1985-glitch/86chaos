#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const suiteRoot = fs.existsSync(path.join(root, 'V9_BASELINE_TEST_MANIFEST.json')) ? root : path.resolve(__dirname, '..');
const baselinePath = path.join(suiteRoot, 'V9_BASELINE_TEST_MANIFEST.json');
const runDir = process.env.CHAOS_RELEASE_GATE_RUN_DIR || path.join(root, 'test-results');
const errors = [];
const warnings = [];

if (!fs.existsSync(baselinePath)) errors.push(`Missing V9 baseline manifest: ${baselinePath}`);
const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : { files: [] };

function staticTitles(text) {
  const rows = [];
  for (const match of String(text).matchAll(/\b(?:test|it)\s*\(\s*(["'`])([\s\S]*?)\1/g)) {
    const title = match[2].replace(/\s+/g, ' ').trim();
    if (title && !title.includes('${')) rows.push(title);
  }
  return rows;
}

for (const item of baseline.files || []) {
  const file = path.join(suiteRoot, item.file);
  if (!fs.existsSync(file)) {
    errors.push(`V9 file removed: ${item.file}`);
    continue;
  }
  if (item.testTitles?.length) {
    const current = new Set(staticTitles(fs.readFileSync(file, 'utf8')));
    for (const title of item.testTitles) if (!current.has(title)) errors.push(`V9 test title removed from ${item.file}: ${title}`);
  }
}

const syntaxFiles = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:cjs|mjs|js)$/.test(entry.name)) syntaxFiles.push(full);
  }
}
for (const dir of ['tests', 'scripts', 'test-tools']) walk(path.join(suiteRoot, dir));
for (const file of syntaxFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) errors.push(`Syntax error in ${path.relative(suiteRoot, file).replace(/\\/g, '/')}: ${(result.stderr || result.stdout || '').trim()}`);
}

const currentFiles = [];
function listFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full);
    else currentFiles.push(path.relative(suiteRoot, full).replace(/\\/g, '/'));
  }
}
listFiles(suiteRoot);
const result = {
  ok: errors.length === 0,
  generatedAt: new Date().toISOString(),
  baselineFileCount: baseline.fileCount || 0,
  baselineStaticTestTitleCount: baseline.staticTestTitleCount || 0,
  currentFileCount: currentFiles.length,
  syntaxFilesChecked: syntaxFiles.length,
  errors,
  warnings,
};
fs.mkdirSync(runDir, { recursive: true });
fs.writeFileSync(path.join(runDir, 'v9-preservation-validation.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
