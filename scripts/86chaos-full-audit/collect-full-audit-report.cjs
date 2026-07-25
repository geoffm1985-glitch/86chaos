#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { loadEnv, env } = require('./env-loader.cjs');
loadEnv(process.cwd());
const root = process.cwd();
const outDir = path.join(root, 'test-results');
fs.mkdirSync(outDir, { recursive: true });
const runId = env('CHAOS_FULL_AUDIT_RUN_ID') || new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = env('CHAOS_FULL_AUDIT_JSON') || path.join(outDir, '86chaos-full-audit-report.json');
const txtPath = path.join(outDir, `86chaos-full-audit-UPLOAD-ME-${runId}.txt`);

function readText(file) { try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; } }
function readJson(file) { try { return JSON.parse(readText(file)); } catch (_) { return null; } }
function section(title, body = '') { return `\n\n================================================================================\n${title}\n================================================================================\n${body}`; }
function artifactFiles() {
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir)) {
      const p = path.join(dir, item);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) walk(p);
      else if (/\.(png|webm|zip|json|txt|log|md)$/i.test(p)) files.push({ path: path.relative(root, p), bytes: stat.size });
    }
  }
  walk(outDir);
  return files.slice(0, 500);
}

const pw = readJson(jsonPath);
const sourceCheck = readJson(path.join(outDir, '86chaos-full-audit-source-check.json'));
const seed = readJson(path.join(outDir, '86chaos-full-audit-seed-report.json'));
const cleanup = readJson(path.join(outDir, '86chaos-full-audit-cleanup-report.json'));
let text = '';
text += '86 CHAOS FULL APP AUDIT UPLOAD PACKET\n';
text += `Generated: ${new Date().toISOString()}\n`;
text += `Run ID: ${runId}\n`;
text += `Repo: ${root}\n`;
text += `Report JSON: ${jsonPath}\n`;
text += `APP_URL: ${env('APP_URL', 'CHAOS_BASE_URL', 'BASE_URL')}\n`;
text += `Expected Version: ${env('CHAOS_EXPECTED_VERSION')}\n`;
text += `Mutation Allowed: ${env('CHAOS_ALLOW_MUTATION')}\n`;

if (pw) {
  const suites = pw.suites || [];
  const allSpecs = [];
  function collectSuite(suite, parent = '') {
    const prefix = parent ? `${parent} > ${suite.title || ''}` : (suite.title || '');
    for (const spec of suite.specs || []) allSpecs.push({ ...spec, suiteTitle: prefix });
    for (const child of suite.suites || []) collectSuite(child, prefix);
  }
  for (const s of suites) collectSuite(s);
  const tests = [];
  for (const spec of allSpecs) {
    for (const test of spec.tests || []) tests.push({ spec, test });
  }
  const failed = tests.filter(t => (t.test.results || []).some(r => r.status !== 'passed' && r.status !== 'skipped'));
  const skipped = tests.filter(t => (t.test.results || []).every(r => r.status === 'skipped'));
  text += section('SUMMARY', [
    `Total specs: ${allSpecs.length}`,
    `Total tests: ${tests.length}`,
    `Failed/non-passed tests: ${failed.length}`,
    `Skipped tests: ${skipped.length}`,
    `Status: ${failed.length ? 'FAILED' : 'PASSED'}`,
  ].join('\n'));
  if (failed.length) {
    text += section('FAILED TESTS');
    for (const entry of failed) {
      const result = (entry.test.results || []).find(r => r.status !== 'passed' && r.status !== 'skipped') || (entry.test.results || [])[0] || {};
      text += `\nFAILED: ${entry.spec.suiteTitle} > ${entry.spec.title}\n`;
      text += `STATUS: ${result.status}\n`;
      text += `DURATION MS: ${result.duration || 0}\n`;
      for (const err of result.errors || []) text += `ERROR: ${(err.message || err.stack || '').slice(0, 4000)}\n`;
      for (const a of result.attachments || []) text += `ATTACHMENT: ${a.name || ''} ${a.path || ''}\n`;
      text += '\n';
    }
  }
  if (skipped.length) {
    text += section('SKIPPED TESTS', skipped.slice(0, 120).map(t => `${t.spec.suiteTitle} > ${t.spec.title}`).join('\n'));
  }
} else {
  text += section('SUMMARY', 'No Playwright JSON report found. The audit command may not have reached the Playwright run.');
}

if (sourceCheck) text += section('SOURCE CHECK', JSON.stringify(sourceCheck, null, 2));
if (seed) text += section('FAKE RESTAURANT SEED REPORT', JSON.stringify(seed, null, 2).slice(0, 30000));
if (cleanup) text += section('CLEANUP REPORT', JSON.stringify(cleanup, null, 2));
text += section('ARTIFACT INDEX', artifactFiles().map(f => `${f.path} (${f.bytes} bytes)`).join('\n'));

const consoleLog = readText(path.join(outDir, '86chaos-full-audit-console.log'));
if (consoleLog) text += section('CONSOLE LOG TAIL', consoleLog.slice(-40000));

fs.writeFileSync(txtPath, text);
console.log(`UPLOAD_THIS_TXT=${txtPath}`);
