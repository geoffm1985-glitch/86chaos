#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const root = process.cwd();
const reporterPath = path.join(root, 'test-tools', 'reporters', 'node-live-timer.mjs');
const reporterSpecifier = pathToFileURL(reporterPath).href;
const files = [];

function addDir(relative, predicate) {
  const dir = path.join(root, relative);
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) addDir(path.relative(root, full), predicate);
    else if (predicate(full)) files.push(full);
  }
}

addDir('api', file => file.endsWith('.test.cjs'));
addDir('tests/86chaos-release-gate', file => file.endsWith('.test.cjs'));
addDir('tests/86chaos-ultimate-store/unit', file => file.endsWith('.test.cjs'));
files.sort();

if (!files.length) {
  console.error('No Node test files were discovered.');
  process.exit(1);
}

if (!fs.existsSync(reporterPath)) {
  console.error(`Node test reporter is missing: ${reporterPath}`);
  process.exit(1);
}

const cliFiles = files.map(file => path.relative(root, file));
console.log(`Running ${cliFiles.length} Node test files with individual live timers.`);
for (const file of cliFiles) console.log(`- ${file}`);

const result = spawnSync(process.execPath, ['--test', '--test-reporter', reporterSpecifier, ...cliFiles], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
  windowsHide: false,
});

if (result.error) {
  console.error(result.error.stack || result.error.message);
  process.exit(1);
}

process.exit(result.status == null ? 1 : result.status);
