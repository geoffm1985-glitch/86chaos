const fs = require('fs');
const path = require('path');
const { ensureRunDir, readJsonIfExists } = require('./run-context.cjs');

const { root, resultsRoot, runId, runDir } = ensureRunDir();
fs.mkdirSync(runDir, { recursive: true });

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

const preflight = readJsonIfExists(path.join(runDir, 'environment-preflight.json')) || {};
const sourceInventory = readJsonIfExists(path.join(runDir, 'source-inventory.json')) || {};
const roleVerification = readJsonIfExists(path.join(runDir, 'role-identity-verification.json')) || {};
const seedReport = readJsonIfExists(path.join(runDir, '86chaos-full-audit-seed-report.json')) || readJsonIfExists(path.join(root, 'test-results', '86chaos-full-audit-seed-report.json')) || {};

const files = walk(runDir);
const jsonFiles = files.filter(p => p.endsWith('.json'));
const summaries = jsonFiles.map(p => ({ file: path.relative(root, p).replace(/\\/g, '/'), data: readJson(p) })).filter(x => x.data);
const playwright = readJson(path.join(runDir, 'playwright-report.json')) || summaries.find(x => x.file.endsWith('/playwright-report.json'))?.data;
const tests = [];
function collectSuites(suites = []) {
  for (const suite of suites) {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        for (const r of t.results || []) tests.push({ title: [...(suite.title ? [suite.title] : []), spec.title, t.title].filter(Boolean).join(' > '), status: r.status, error: r.error?.message || '', duration: r.duration || 0, projectName: t.projectName || '' });
      }
    }
    collectSuites(suite.suites || []);
  }
}
if (playwright) collectSuites(playwright.suites || []);
const failedTests = tests.filter(t => !['passed', 'skipped'].includes(t.status));
const skippedTests = tests.filter(t => t.status === 'skipped');
const timedOutTests = tests.filter(t => t.status === 'timedOut');

const missingArtifacts = [];
for (const required of ['environment-preflight.json', 'source-inventory.json', 'playwright-report.json']) {
  if (!fs.existsSync(path.join(runDir, required))) missingArtifacts.push(required);
}

const appUrl = process.env.APP_URL || process.env.CHAOS_BASE_URL || preflight.appUrl || '';
const expectedVersion = process.env.CHAOS_EXPECTED_VERSION || preflight.expectedVersion || '';
const testedVersion = preflight.deployedVersion || preflight.visibleVersion || expectedVersion || '';
const stepFailures = Number(process.env.CHAOS_RELEASE_GATE_STEP_FAILURES || 0);
const versionMismatch = Boolean(expectedVersion && testedVersion && expectedVersion !== testedVersion);
if (versionMismatch) missingArtifacts.push(`version-mismatch expected=${expectedVersion} tested=${testedVersion}`);

const failureGroups = [];
const groupRe = [
  [/timeout/i, 'timeout'],
  [/System Administrator|Restricted Platform Tools|superAdmin|manager/i, 'role-permission'],
  [/Schedule Builder|Allen QA|Chuck QA|Lani QA/i, 'schedule-seed-visibility'],
  [/axe|WCAG|contrast|keyboard|focus/i, 'accessibility'],
  [/listener|Firestore|write storm|Listen/i, 'firebase-idempotency'],
  [/chunk|reload loop/i, 'chunk-recovery'],
  [/400|5xx|requestfailed|connection reset/i, 'network-classification'],
  [/coverage|JavaScript/i, 'runtime-coverage'],
  [/control|mutating/i, 'control-census'],
];
for (const t of failedTests) {
  const text = `${t.title}\n${t.error}`;
  const group = groupRe.find(([re]) => re.test(text))?.[1] || 'other';
  if (!failureGroups.some(x => x.group === group)) failureGroups.push({ group, examples: [] });
  const row = failureGroups.find(x => x.group === group);
  if (row.examples.length < 5) row.examples.push(t.title);
}

const summary = {
  ok: failedTests.length === 0 && skippedTests.length === 0 && stepFailures === 0 && missingArtifacts.length === 0 && !versionMismatch,
  generatedAt: new Date().toISOString(),
  runId,
  appUrl,
  expectedVersion,
  sourceVersion: preflight.sourceVersion || sourceInventory.version || '',
  deployedVersion: preflight.deployedVersion || '',
  visibleVersion: preflight.visibleVersion || '',
  testedVersion,
  firebaseProjectId: preflight.firebaseProjectId || sourceInventory.firebaseProjectId || '',
  node: process.version,
  stepFailures,
  playwright: { totalResults: tests.length, failed: failedTests.length, timedOut: timedOutTests.length, skipped: skippedTests.length, failedTests: failedTests.slice(0, 200), skippedTests: skippedTests.slice(0, 200) },
  seedReport: seedReport && seedReport.ok !== undefined ? { ok: seedReport.ok, runId: seedReport.runId || '', restaurantId: seedReport.restaurantId || seedReport.profile?.restaurantId || '', restaurantName: seedReport.restaurantName || '' } : null,
  roleIdentityVerification: roleVerification && roleVerification.ok !== undefined ? roleVerification : null,
  failureGroups,
  missingArtifacts,
  artifacts: summaries.map(x => x.file).filter(f => f.includes(`/86chaos-play-store-release-gate/${runId}/`) || f.includes(`\\86chaos-play-store-release-gate\\${runId}\\`)),
  truth: [
    'This report includes only the current run directory.',
    'A release is blocked by any failed test, timed-out test, unexpected skipped test, missing artifact, stale deployment, or uncovered mutating control.',
    'End-to-end runtime byte coverage is evidence of execution, not proof of correctness for every possible input.',
  ],
};

const jsonPath = path.join(runDir, `86chaos-play-store-release-gate-summary-${testedVersion || 'unknown'}-${runId}.json`);
const textPath = path.join(runDir, `86chaos-play-store-release-gate-UPLOAD-ME-${testedVersion || 'unknown'}-${runId}.txt`);
fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
const lines = [
  '86 CHAOS PLAY STORE RELEASE GATE',
  `Generated: ${summary.generatedAt}`,
  `Run ID: ${runId}`,
  `App URL: ${summary.appUrl}`,
  `Expected Version: ${summary.expectedVersion}`,
  `Source Version: ${summary.sourceVersion}`,
  `Deployed Version: ${summary.deployedVersion}`,
  `Visible Version: ${summary.visibleVersion}`,
  `Testing Firebase project: ${summary.firebaseProjectId}`,
  `Node: ${summary.node}`,
  `Overall: ${summary.ok ? 'PASS' : 'FAIL'}`,
  `Runner step failures: ${summary.stepFailures}`,
  `Playwright results: ${tests.length}`,
  `Playwright failed: ${failedTests.length}`,
  `Playwright timed out: ${timedOutTests.length}`,
  `Playwright skipped: ${skippedTests.length}`,
  '',
  'IMPORTANT',
  ...summary.truth,
  '',
  'FAILURE GROUPS',
  ...(failureGroups.length ? failureGroups.map(g => `- ${g.group}: ${g.examples.join(' | ')}`) : ['- None']),
  '',
  'FAILED TESTS',
  ...(failedTests.length ? failedTests.map(t => `- ${t.title}: ${t.error}`) : ['- None']),
  '',
  'SKIPPED TESTS',
  ...(skippedTests.length ? skippedTests.map(t => `- ${t.title}`) : ['- None']),
  '',
  'MISSING ARTIFACTS',
  ...(missingArtifacts.length ? missingArtifacts.map(f => `- ${f}`) : ['- None']),
  '',
  'JSON ARTIFACTS',
  ...summary.artifacts.map(f => `- ${f}`),
];
fs.writeFileSync(textPath, lines.join('\n'));
console.log(JSON.stringify({ summary, jsonPath, textPath, resultsRoot, runDir }, null, 2));
