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
function countStaticTests(file) {
  const text = fs.readFileSync(file, 'utf8');
  return [...text.matchAll(/\b(?:test|it)\s*\(\s*(["'`])([\s\S]*?)\1/g)]
    .filter(match => !match[2].includes('${')).length;
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
const staticCount = files.reduce((sum, file) => sum + countStaticTests(file), 0);
let dynamicEstimate = 0;
try {
  const parser = require(require.resolve('@babel/parser', { paths: [root] }));
  const traverse = require(require.resolve('@babel/traverse', { paths: [root] })).default;
  const sourceFiles = [];
  const collect = dir => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (/\.(?:js|jsx)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name)) sourceFiles.push(full);
    }
  };
  collect(path.join(root, 'src'));
  collect(path.join(root, 'api'));
  for (const file of sourceFiles) {
    const ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'unambiguous', plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'topLevelAwait'] });
    traverse(ast, {
      FunctionDeclaration() { dynamicEstimate += 1; },
      FunctionExpression() { dynamicEstimate += 1; },
      ArrowFunctionExpression() { dynamicEstimate += 1; },
      ClassMethod() { dynamicEstimate += 1; },
      ObjectMethod() { dynamicEstimate += 1; },
    });
  }
  // The function inventory has one static summary test plus one generated test per function.
  // Other dynamic inventory files add collection and plan cases; leave a conservative allowance.
  dynamicEstimate += 80;
} catch (_) {}
const estimatedTotal = staticCount + dynamicEstimate;
console.log(`Running ${cliFiles.length} Node test files with individual live timers.`);
console.log(`Static test title count: ${staticCount}. Estimated generated cases: ${dynamicEstimate}. Estimated total: ${estimatedTotal}.`);
for (const file of cliFiles) console.log(`- ${file}`);

const result = spawnSync(process.execPath, ['--test', '--test-reporter', reporterSpecifier, ...cliFiles], {
  cwd: root,
  env: { ...process.env, CHAOS_NODE_TEST_TOTAL: String(estimatedTotal || staticCount) },
  stdio: 'inherit',
  windowsHide: false,
});

if (result.error) {
  console.error(result.error.stack || result.error.message);
  process.exit(1);
}
process.exit(result.status == null ? 1 : result.status);
