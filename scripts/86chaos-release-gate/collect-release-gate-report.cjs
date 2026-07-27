const fs = require('fs');
const path = require('path');

const root = process.cwd();
const resultsRoot = path.join(root, 'test-results', '86chaos-play-store-release-gate');
fs.mkdirSync(resultsRoot, { recursive: true });
const runId = process.env.CHAOS_RELEASE_GATE_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

const files = walk(resultsRoot);
const jsonFiles = files.filter(p => p.endsWith('.json'));
const summaries = jsonFiles.map(p => ({ file: path.relative(root, p).replace(/\\/g, '/'), data: readJson(p) })).filter(x => x.data);
const playwright = summaries.find(x => x.file.endsWith('playwright-report.json'))?.data;
const tests = [];
function collectSuites(suites = []) {
  for (const suite of suites) {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        for (const r of t.results || []) tests.push({ title: [...(suite.title ? [suite.title] : []), spec.title, t.title].filter(Boolean).join(' > '), status: r.status, error: r.error?.message || '' });
      }
    }
    collectSuites(suite.suites || []);
  }
}
if (playwright) collectSuites(playwright.suites || []);
const failedTests = tests.filter(t => !['passed', 'skipped'].includes(t.status));
const skippedTests = tests.filter(t => t.status === 'skipped');

const summary = {
  ok: failedTests.length === 0 && skippedTests.length === 0 && Number(process.env.CHAOS_RELEASE_GATE_STEP_FAILURES || 0) === 0,
  generatedAt: new Date().toISOString(),
  runId,
  appUrl: process.env.APP_URL || process.env.CHAOS_BASE_URL || '',
  expectedVersion: process.env.CHAOS_EXPECTED_VERSION || '',
  node: process.version,
  stepFailures: Number(process.env.CHAOS_RELEASE_GATE_STEP_FAILURES || 0),
  playwright: { totalResults: tests.length, failed: failedTests.length, skipped: skippedTests.length, failedTests: failedTests.slice(0, 200), skippedTests: skippedTests.slice(0, 200) },
  artifacts: summaries.map(x => x.file),
  truth: [
    'This report does not claim the software is flawless.',
    'A release is blocked by any failed test, any skipped test, any uncovered mutating control, or any missing coverage report.',
    'End-to-end runtime byte coverage is evidence of execution, not proof of correctness for every possible input.',
  ],
};

const jsonPath = path.join(resultsRoot, `86chaos-play-store-release-gate-summary-${runId}.json`);
const textPath = path.join(resultsRoot, `86chaos-play-store-release-gate-UPLOAD-ME-${runId}.txt`);
fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
const lines = [
  '86 CHAOS PLAY STORE RELEASE GATE',
  `Generated: ${summary.generatedAt}`,
  `Run ID: ${runId}`,
  `App URL: ${summary.appUrl}`,
  `Expected Version: ${summary.expectedVersion}`,
  `Node: ${summary.node}`,
  `Overall: ${summary.ok ? 'PASS' : 'FAIL'}`,
  `Runner step failures: ${summary.stepFailures}`,
  `Playwright results: ${tests.length}`,
  `Playwright failed: ${failedTests.length}`,
  `Playwright skipped: ${skippedTests.length}`,
  '',
  'IMPORTANT',
  ...summary.truth,
  '',
  'FAILED TESTS',
  ...(failedTests.length ? failedTests.map(t => `- ${t.title}: ${t.error}`) : ['- None']),
  '',
  'SKIPPED TESTS',
  ...(skippedTests.length ? skippedTests.map(t => `- ${t.title}`) : ['- None']),
  '',
  'JSON ARTIFACTS',
  ...summary.artifacts.map(f => `- ${f}`),
];
fs.writeFileSync(textPath, lines.join('\n'));
console.log(JSON.stringify({ summary, jsonPath, textPath }, null, 2));
