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

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

addDir('api', file => file.endsWith('.test.cjs'));
addDir('tests/86chaos-release-gate', file => file.endsWith('.test.cjs'));
addDir('tests/86chaos-ultimate-store/unit', file => file.endsWith('.test.cjs'));
files.sort();

const runDir = process.env.CHAOS_RELEASE_GATE_RUN_DIR || path.join(root, 'test-results', '86chaos-ultimate-store-tests', 'node-local');
const cliFiles = files.map(file => path.relative(root, file));
const summaryPath = path.join(runDir, 'node-test-live-summary.json');

if (!files.length) {
  writeJson(summaryPath, { ok: false, discoveredFiles: 0, executed: 0, passed: 0, failed: 0, skipped: 0, cancelled: 0, errors: ['No Node test files were discovered.'] });
  console.error('No Node test files were discovered.');
  process.exit(1);
}

if (!fs.existsSync(reporterPath)) {
  writeJson(summaryPath, { ok: false, discoveredFiles: files.length, executed: 0, passed: 0, failed: 0, skipped: 0, cancelled: 0, errors: [`Node test reporter is missing: ${reporterPath}`] });
  console.error(`Node test reporter is missing: ${reporterPath}`);
  process.exit(1);
}

console.log(`Running ${cliFiles.length} Node test files with individual live timers.`);
for (const file of cliFiles) console.log(`- ${file}`);

const reporter = process.env.CHAOS_NODE_TEST_REPORTER === 'spec' ? 'spec' : reporterSpecifier;
const result = spawnSync(process.execPath, ['--test', '--test-reporter', reporter, ...cliFiles], {
  cwd: root,
  env: { ...process.env, CHAOS_NODE_TEST_SUMMARY_PATH: summaryPath },
  stdio: 'inherit',
  windowsHide: false,
});

if (result.error) {
  writeJson(summaryPath, { ok: false, discoveredFiles: files.length, executed: 0, passed: 0, failed: 1, skipped: 0, cancelled: 0, errors: [result.error.message] });
  console.error(result.error.stack || result.error.message);
  process.exit(1);
}

if (!fs.existsSync(summaryPath)) {
  writeJson(summaryPath, {
    ok: result.status === 0,
    discoveredFiles: files.length,
    executed: null,
    passed: null,
    failed: result.status === 0 ? 0 : null,
    skipped: null,
    cancelled: null,
    reporter,
    note: 'The reporter did not write an event summary. Re-run with CHAOS_NODE_TEST_REPORTER=spec for built-in detailed output.',
  });
}

process.exit(result.status == null ? 1 : result.status);
