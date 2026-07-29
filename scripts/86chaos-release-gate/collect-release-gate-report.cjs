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
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; } }
function rel(p) { return path.relative(root, p).replace(/\\/g, '/'); }

const requiredArtifacts = [
  'environment-preflight.json',
  'source-inventory.json',
  'role-identity-verification.json',
  'qa-setup-state.json',
  '86chaos-full-audit-seed-report.json',
  'playwright-report.json',
  '86chaos-full-audit-cleanup-report.json',
];
const artifact = Object.fromEntries(requiredArtifacts.map(name => [name, path.join(runDir, name)]));
const missingArtifacts = requiredArtifacts.filter(name => !fs.existsSync(artifact[name]));

const preflight = readJsonIfExists(artifact['environment-preflight.json']) || {};
const sourceInventory = readJsonIfExists(artifact['source-inventory.json']) || {};
const roleVerification = readJsonIfExists(artifact['role-identity-verification.json']) || {};
const setupState = readJsonIfExists(artifact['qa-setup-state.json']) || {};
const seedReport = readJsonIfExists(artifact['86chaos-full-audit-seed-report.json']) || {};
const cleanupReport = readJsonIfExists(artifact['86chaos-full-audit-cleanup-report.json']) || {};
const failedOnlyManifest = readJsonIfExists(path.join(runDir, 'failed-only-test-manifest.json')) || null;

const files = walk(runDir);
const jsonFiles = files.filter(p => p.endsWith('.json'));
const summaries = jsonFiles.map(p => ({ file: rel(p), data: readJson(p) })).filter(x => x.data);
const playwright = readJson(artifact['playwright-report.json']);
const tests = [];
function collectSuites(suites = [], parents = []) {
  for (const suite of suites) {
    const nextParents = suite.title ? [...parents, suite.title] : parents;
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        for (const r of t.results || []) {
          tests.push({
            title: [...nextParents, spec.title, t.title].filter(Boolean).join(' > '),
            status: r.status,
            error: r.error?.message || '',
            duration: r.duration || 0,
            projectName: t.projectName || '',
            file: spec.file || '',
          });
        }
      }
    }
    collectSuites(suite.suites || [], nextParents);
  }
}
if (playwright) collectSuites(playwright.suites || []);
const failedTests = tests.filter(t => !['passed', 'skipped'].includes(t.status));
const skippedTests = tests.filter(t => t.status === 'skipped');
const timedOutTests = tests.filter(t => t.status === 'timedOut' || /timeout/i.test(t.error || ''));

const appUrl = process.env.APP_URL || process.env.CHAOS_BASE_URL || preflight.appUrl || '';
const expectedVersion = process.env.CHAOS_EXPECTED_VERSION || preflight.expectedVersion || '';
const testedVersion = preflight.deployedVersion || preflight.visibleVersion || expectedVersion || '';
const stepFailures = Number(process.env.CHAOS_RELEASE_GATE_STEP_FAILURES || 0);
const versionMismatch = Boolean(expectedVersion && testedVersion && expectedVersion !== testedVersion);
if (versionMismatch) missingArtifacts.push(`version-mismatch expected=${expectedVersion} tested=${testedVersion}`);

const runMismatchFailures = [];
for (const [name, data] of Object.entries({ preflight, sourceInventory, roleVerification, setupState, seedReport, cleanupReport })) {
  if (data && data.runId && data.runId !== runId) runMismatchFailures.push(`${name} runId=${data.runId} expected=${runId}`);
}
if (runMismatchFailures.length) missingArtifacts.push(...runMismatchFailures.map(x => `run-mismatch ${x}`));

const setupFailures = [];
if (setupState && setupState.errors?.length) setupFailures.push(...setupState.errors);
if (setupState && setupState.attempted && setupState.verified !== true) setupFailures.push('QA setup was attempted but not verified.');
if (seedReport && seedReport.ok !== true) setupFailures.push(`Seed report not ok:true: ${seedReport.error || 'unknown seed failure'}`);
if (seedReport && seedReport.verification && seedReport.verification.ok !== true) setupFailures.push('Seed verification failed.');

const cleanupFailures = [];
if (cleanupReport && cleanupReport.ok !== true) cleanupFailures.push(`Cleanup report not ok:true: ${cleanupReport.error || 'unknown cleanup failure'}`);
if (cleanupReport && cleanupReport.runId && cleanupReport.runId !== runId) cleanupFailures.push(`Cleanup used runId ${cleanupReport.runId} instead of ${runId}.`);
if (cleanupReport && cleanupReport.restaurantRemaining) cleanupFailures.push('Current-run restaurant still remains after cleanup.');
if (cleanupReport && cleanupReport.remaining && Object.keys(cleanupReport.remaining).length) cleanupFailures.push(`Current-run child records remain: ${JSON.stringify(cleanupReport.remaining)}`);
if (cleanupReport && cleanupReport.accountedFailures?.length) cleanupFailures.push(`Cleanup did not account for seeded records: ${JSON.stringify(cleanupReport.accountedFailures)}`);

const failureGroups = [];
const groupRe = [
  [/setup|seed|cleanup|stale|runId|artifact/i, 'harness-seed-cleanup'],
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
for (const text of [...setupFailures, ...cleanupFailures, ...missingArtifacts]) {
  const group = /seed|cleanup|setup|artifact|run/i.test(text) ? 'harness-seed-cleanup' : 'reporting';
  if (!failureGroups.some(x => x.group === group)) failureGroups.push({ group, examples: [] });
  const row = failureGroups.find(x => x.group === group);
  if (row.examples.length < 5) row.examples.push(text);
}

const ok = failedTests.length === 0 && timedOutTests.length === 0 && skippedTests.length === 0 && stepFailures === 0 && missingArtifacts.length === 0 && !versionMismatch && setupFailures.length === 0 && cleanupFailures.length === 0;
const summary = {
  ok,
  generatedAt: new Date().toISOString(),
  runId,
  runDir,
  appUrl,
  expectedVersion,
  sourceVersion: preflight.sourceVersion || sourceInventory.version || sourceInventory.packageVersion || '',
  deployedVersion: preflight.deployedVersion || '',
  visibleVersion: preflight.visibleVersion || '',
  testedVersion,
  firebaseProjectId: preflight.firebaseProjectId || sourceInventory.firebaseProjectId || '',
  node: process.version,
  stepFailures,
  playwright: { totalResults: tests.length, failed: failedTests.length, timedOut: timedOutTests.length, skipped: skippedTests.length, failedTests: failedTests.slice(0, 200), skippedTests: skippedTests.slice(0, 200) },
  seed: seedReport && seedReport.ok !== undefined ? { ok: seedReport.ok, runId: seedReport.runId || '', restaurantId: seedReport.restaurantId || seedReport.profile?.restaurantId || '', restaurantName: seedReport.restaurantName || seedReport.profile?.restaurantName || '', expectedCounts: seedReport.expectedCounts || {}, verifiedCounts: seedReport.verification?.verifiedCounts || {}, verificationOk: seedReport.verification?.ok === true } : null,
  cleanup: cleanupReport && cleanupReport.ok !== undefined ? { ok: cleanupReport.ok, runId: cleanupReport.runId || '', expected: cleanupReport.expected || {}, deleted: cleanupReport.deleted || {}, alreadyAbsent: cleanupReport.alreadyAbsent || {}, remaining: cleanupReport.remaining || {}, additionalRunRecords: cleanupReport.additionalRunRecords || {}, restaurantDeleted: cleanupReport.restaurantDeleted || 0, failures: cleanupReport.failed || [], accountedFailures: cleanupReport.accountedFailures || [] } : null,
  setupState,
  roleIdentityVerification: roleVerification && roleVerification.ok !== undefined ? roleVerification : null,
  failedOnlyManifest,
  failureGroups,
  missingArtifacts,
  setupFailures,
  cleanupFailures,
  artifacts: summaries.map(x => x.file).filter(f => f.includes(`/86chaos-play-store-release-gate/${runId}/`)),
  truth: [
    'This report reads only the current run directory.',
    'Root-level legacy seed and cleanup reports are not authoritative.',
    'A release is blocked by failed tests, timed-out tests, unexpected skipped tests, missing artifacts, stale deployment, setup failure, cleanup failure, or current-run QA records remaining.',
  ],
};

const jsonPath = path.join(runDir, `86chaos-play-store-release-gate-summary-${testedVersion || 'unknown'}-${runId}.json`);
const textPath = path.join(runDir, `86chaos-play-store-release-gate-UPLOAD-ME-${testedVersion || 'unknown'}-${runId}.txt`);
fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
const lines = [
  '86 CHAOS PLAY STORE RELEASE GATE',
  `Generated: ${summary.generatedAt}`,
  `Run ID: ${runId}`,
  `Run directory: ${runDir}`,
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
  'SEED VERIFICATION',
  JSON.stringify(summary.seed || {}, null, 2),
  '',
  'CLEANUP VERIFICATION',
  JSON.stringify(summary.cleanup || {}, null, 2),
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
  'SETUP FAILURES',
  ...(setupFailures.length ? setupFailures.map(f => `- ${f}`) : ['- None']),
  '',
  'CLEANUP FAILURES',
  ...(cleanupFailures.length ? cleanupFailures.map(f => `- ${f}`) : ['- None']),
  '',
  'JSON ARTIFACTS',
  ...summary.artifacts.map(f => `- ${f}`),
];
fs.writeFileSync(textPath, lines.join('\n'));
console.log(JSON.stringify({ summary, jsonPath, textPath, resultsRoot, runDir }, null, 2));
if (!summary.ok) process.exitCode = 1;
