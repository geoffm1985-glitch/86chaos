'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { captureSourceIdentity } = require('../scripts/86chaos-release-gate/source-identity.cjs');
const { normalizePlaywrightResults } = require('../scripts/86chaos-release-gate/playwright-result-normalizer.cjs');
const { stableIdentityKey, findFocusedTestDeclarations } = require('../scripts/86chaos-release-gate/playwright-inventory.cjs');
const { runStreamedCommand } = require('../scripts/86chaos-release-gate/streamed-command-runner.cjs');
const { firstUsefulFailureFromOutput } = require('../scripts/86chaos-release-gate/failure-extractor.cjs');

const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const writeJson = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2)); };

function resultReport(rows) {
  const specs = rows.map((row, index) => ({
    title: row.leafTitle,
    file: row.specPath,
    tests: [{
      projectName: row.project,
      expectedStatus: 'passed',
      annotations: [],
      results: row.results || [{ status: 'passed', duration: 5 + index }],
    }],
  }));
  return { config: { rootDir: path.join(root, 'tests') }, suites: [{ title: 'e2e/example.spec.cjs', specs, suites: [] }], errors: [], stats: { expected: rows.length, skipped: 0, unexpected: 0, flaky: 0, duration: 10, startTime: new Date().toISOString() } };
}
function inventoryRecord(row) {
  const record = { specPath: row.specPath, fullSuitePath: '', suitePathParts: [], leafTitle: row.leafTitle, exactTestTitle: row.leafTitle, title: row.leafTitle, fullTitle: row.leafTitle, project: row.project, sourceFileHash: '0'.repeat(64) };
  record.stableKey = stableIdentityKey(record);
  return record;
}
function makeCollectorFixture(name, { reportRows, inventoryRows = reportRows, cleanupOk = true, sourceDrift = false } = {}) {
  const runId = `unit-17-0-19-${name}-${process.pid}-${Date.now()}`;
  const runDir = path.join(root, 'test-results', '86chaos-play-store-release-gate', runId);
  fs.rmSync(runDir, { recursive: true, force: true });
  fs.mkdirSync(runDir, { recursive: true });
  const common = { ok: true, runId };
  writeJson(path.join(runDir, 'runner-state.json'), {
    runId, mode: 'full', playwrightStarted: true, dependencyInstallAttempted: true, dependencyInstallPassed: true,
    dependencyPreflightPassed: true, sourceInventoryPassed: true, browserInstallPassed: true,
    serverIdentityPreflightStarted: true, serverIdentityPreflightPassed: true,
    testAccountProvisionAttempted: true, testAccountProvisionPassed: true,
    rolePreflightStarted: true, rolePreflightPassed: true, postPlaywrightChecksStarted: true, postPlaywrightChecksPassed: true,
    blockingReason: '', currentPhase: 'report-collection', status: 'running', cleanupAttempted: true, cleanupCompleted: cleanupOk,
  });
  writeJson(path.join(runDir, 'environment-preflight.json'), { ...common, expectedVersion: version, sourceVersion: version, deployedVersion: version, certificationMode: false, firebaseProjectId: 'chaos-test-d1601' });
  writeJson(path.join(runDir, 'dependency-preflight.json'), common);
  writeJson(path.join(runDir, 'source-inventory.json'), { ...common, version, packageVersion: version, firebaseProjectId: 'chaos-test-d1601' });
  writeJson(path.join(runDir, 'server-firebase-boundary-preflight.json'), common);
  writeJson(path.join(runDir, 'test-account-provisioning.json'), common);
  writeJson(path.join(runDir, 'role-identity-verification.json'), common);
  writeJson(path.join(runDir, 'java-prerequisite.json'), common);
  writeJson(path.join(runDir, 'node-test-live-summary.json'), { ...common, results: [] });
  writeJson(path.join(runDir, 'firebase-rules-release-gate.json'), { ...common, totalCases: 1, passed: 1, failed: 0, blocked: 0 });
  writeJson(path.join(runDir, 'qa-setup-state.json'), { ...common, attempted: true, verified: true, writesStarted: true, seeded: true });
  writeJson(path.join(runDir, '86chaos-full-audit-seed-report.json'), { ...common, verification: { ok: true } });
  writeJson(path.join(runDir, '86chaos-full-audit-cleanup-report.json'), cleanupOk ? { ...common, remaining: {}, accountedFailures: [] } : { ...common, ok: false, error: 'synthetic cleanup failure', remaining: {}, accountedFailures: [] });
  writeJson(path.join(runDir, 'playwright-report.json'), resultReport(reportRows));
  const records = inventoryRows.map(inventoryRecord);
  writeJson(path.join(runDir, 'playwright-test-inventory.json'), { ok: true, runId, sourceVersion: version, discoveryMode: 'playwright-list', focusedTestCount: 0, duplicateIdentityCount: 0, records });
  const source = captureSourceIdentity(root);
  if (sourceDrift) source.sourceHash = 'f'.repeat(64);
  writeJson(path.join(runDir, 'source-identity-start.json'), source);
  return { runId, runDir };
}
function runCollector(fixture) {
  const result = spawnSync(process.execPath, ['scripts/86chaos-release-gate/collect-release-gate-report.cjs'], {
    cwd: root,
    env: { ...process.env, CHAOS_RELEASE_GATE_RUN_ID: fixture.runId, CHAOS_RELEASE_GATE_RUN_DIR: fixture.runDir, CHAOS_RELEASE_GATE_SELECTION_MODE: 'full', CHAOS_EXPECTED_VERSION: version, CHAOS_RELEASE_GATE_STEP_FAILURES: '0', CHAOS_CERTIFICATION_MODE: 'false' },
    encoding: 'utf8',
  });
  const summaryFile = fs.readdirSync(fixture.runDir).find(file => file.startsWith('86chaos-play-store-release-gate-summary-') && file.endsWith('.json'));
  const summary = summaryFile ? JSON.parse(fs.readFileSync(path.join(fixture.runDir, summaryFile), 'utf8')) : null;
  return { result, summary };
}

const one = { specPath: 'e2e/example.spec.cjs', leafTitle: 'one passes', project: 'chromium' };
const two = { specPath: 'e2e/example.spec.cjs', leafTitle: 'two passes', project: 'chromium' };

test('17.0.19 collector accepts a complete unique full universe and exits zero', () => {
  const fixture = makeCollectorFixture('complete', { reportRows: [one], inventoryRows: [one] });
  try {
    const { result, summary } = runCollector(fixture);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(summary.ok, true);
    assert.equal(summary.playwright.fullUniverseValidation.ok, true);
    assert.equal(summary.playwright.totalResults, 1);
  } finally { fs.rmSync(fixture.runDir, { recursive: true, force: true }); }
});

test('17.0.19 collector rejects an incomplete full Playwright universe and exits nonzero without erasing executed counts', () => {
  const fixture = makeCollectorFixture('missing', { reportRows: [one], inventoryRows: [one, two] });
  try {
    const { result, summary } = runCollector(fixture);
    assert.notEqual(result.status, 0);
    assert.equal(summary.ok, false);
    assert.equal(summary.playwright.totalResults, 1);
    assert.equal(summary.playwright.passed, 1);
    assert.equal(summary.playwright.fullUniverseValidation.missingExecutionCount, 1);
    assert.equal(summary.fullReleaseCertified, false);
  } finally { fs.rmSync(fixture.runDir, { recursive: true, force: true }); }
});

test('17.0.19 collector fails closed for cleanup failure and source drift while preserving browser results', () => {
  for (const [name, options] of [['cleanup', { cleanupOk: false }], ['drift', { sourceDrift: true }]]) {
    const fixture = makeCollectorFixture(name, { reportRows: [one], inventoryRows: [one], ...options });
    try {
      const { result, summary } = runCollector(fixture);
      assert.notEqual(result.status, 0, `${name} unexpectedly exited zero`);
      assert.equal(summary.ok, false);
      assert.equal(summary.playwright.passed, 1);
      assert.equal(summary.playwright.totalResults, 1);
      assert.equal(summary.fullReleaseCertified, false);
    } finally { fs.rmSync(fixture.runDir, { recursive: true, force: true }); }
  }
});

test('17.0.19 retry accounting counts one test identity and preserves attempt history', () => {
  const report = resultReport([{ ...one, results: [{ status: 'failed', duration: 3, error: { message: 'first attempt failed' } }, { status: 'passed', duration: 4 }] }]);
  const normalized = normalizePlaywrightResults(report);
  assert.equal(normalized.tests.length, 1);
  assert.equal(normalized.attemptsTotal, 2);
  assert.equal(normalized.retryCount, 1);
  assert.equal(normalized.tests[0].status, 'passed');
  assert.equal(normalized.tests[0].flaky, true);
  assert.deepEqual(normalized.tests[0].attempts.map(row => row.status), ['failed', 'passed']);
});

test('17.0.19 release inventory source scan rejects real .only while ignoring comments and strings', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-focus-'));
  try {
    const dir = path.join(temp, 'tests', 'e2e');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'focus.spec.cjs'), "// test.only('comment',()=>{})\nconst text=\"test.only('string')\";\ntest.only('real focus', async()=>{});\n");
    const findings = findFocusedTestDeclarations(temp);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].specPath, 'e2e/focus.spec.cjs');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('17.0.19 streamed failure evidence survives more than 512 KiB of later output and chunk boundaries', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-stream-failure-'));
  const script = path.join(temp, 'fail.cjs');
  try {
    fs.writeFileSync(script, "process.stdout.write('TAP version 13\\nnot ok 1 - critical current assertion\\n  Assertion'); setTimeout(()=>{process.stdout.write('Error [ERR_ASSERTION]: expected current metadata\\n'); process.stdout.write('x'.repeat(700000)); process.exitCode=1;},5);\n");
    const quote = value => process.platform === 'win32' ? `\"${String(value).replace(/\"/g, '\"\"')}\"` : `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
    const child = await runStreamedCommand({ command: `${quote(process.execPath)} ${quote(script)}`, cwd: root, timeoutMs: 10000, heartbeatMs: 1000, tailLimit: 512 * 1024, onStdout: () => {}, onStderr: () => {} });
    assert.notEqual(child.status, 0);
    assert.doesNotMatch(child.stdout, /critical current assertion/);
    const failure = firstUsefulFailureFromOutput(child);
    assert.match(failure, /critical current assertion|expected current metadata/i);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('17.0.19 collector rejects extra and duplicate full-universe executions', () => {
  for (const [name, reportRows, inventoryRows, field] of [
    ['extra', [one, two], [one], 'extraExecutionCount'],
    ['duplicate', [one, one], [one], 'executedDuplicateCount'],
  ]) {
    const fixture = makeCollectorFixture(name, { reportRows, inventoryRows });
    try {
      const { result, summary } = runCollector(fixture);
      assert.notEqual(result.status, 0);
      assert.equal(summary.ok, false);
      assert.ok(summary.playwright.fullUniverseValidation[field] > 0, `${name} should report ${field}`);
    } finally { fs.rmSync(fixture.runDir, { recursive: true, force: true }); }
  }
});

test('17.0.19 actual collector counts a retry sequence as one final test outcome', () => {
  const retried = { ...one, results: [{ status: 'failed', duration: 2, error: { message: 'transient first attempt' } }, { status: 'passed', duration: 3 }] };
  const fixture = makeCollectorFixture('retry-collector', { reportRows: [retried], inventoryRows: [one] });
  try {
    const { result, summary } = runCollector(fixture);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(summary.ok, true);
    assert.equal(summary.playwright.totalResults, 1);
    assert.equal(summary.playwright.passed, 1);
    assert.equal(summary.playwright.attemptsTotal, 2);
    assert.equal(summary.playwright.retryCount, 1);
    assert.equal(summary.playwright.flakyCount, 1);
    assert.equal(summary.playwright.retryAttemptHistory.length, 1);
  } finally { fs.rmSync(fixture.runDir, { recursive: true, force: true }); }
});

test('17.0.19 Playwright final failure blocks certification even when post-check evidence passes', () => {
  const failed = { ...one, results: [{ status: 'failed', duration: 3, error: { message: 'real application assertion failed' } }] };
  const fixture = makeCollectorFixture('playwright-failed', { reportRows: [failed], inventoryRows: [one] });
  try {
    const { result, summary } = runCollector(fixture);
    assert.notEqual(result.status, 0);
    assert.equal(summary.ok, false);
    assert.equal(summary.playwright.totalResults, 1);
    assert.equal(summary.playwright.failed, 1);
    assert.equal(summary.playwright.fullUniverseValidation.ok, true);
    assert.equal(summary.fullReleaseCertified, false);
  } finally { fs.rmSync(fixture.runDir, { recursive: true, force: true }); }
});

test('17.0.19 Playwright timeout blocks certification without turning an executed run into TOTAL 0', () => {
  const timedOut = { ...one, results: [{ status: 'timedOut', duration: 45000, error: { message: 'Timeout 45000ms exceeded' } }] };
  const fixture = makeCollectorFixture('playwright-timeout', { reportRows: [timedOut], inventoryRows: [one] });
  try {
    const { result, summary } = runCollector(fixture);
    assert.notEqual(result.status, 0);
    assert.equal(summary.ok, false);
    assert.equal(summary.playwright.totalResults, 1);
    assert.equal(summary.playwright.timedOut, 1);
    assert.equal(summary.playwright.status, 'Tests executed');
    assert.equal(summary.fullReleaseCertified, false);
  } finally { fs.rmSync(fixture.runDir, { recursive: true, force: true }); }
});

test('17.0.19 named timed-out and interrupted post-check evidence remains actionable in the collector', () => {
  for (const status of ['timedOut', 'interrupted']) {
    const fixture = makeCollectorFixture(`node-${status}`, { reportRows: [one], inventoryRows: [one] });
    try {
      writeJson(path.join(fixture.runDir, 'node-test-live-summary.json'), {
        ok: false,
        runId: fixture.runId,
        results: [{ group: 'hostile certification', required: true, status, firstUsefulFailure: `hostile certification ${status} with child tree cleaned` }],
      });
      const { result, summary } = runCollector(fixture);
      assert.notEqual(result.status, 0);
      assert.match(summary.nodeFailures.join('\n'), new RegExp(`hostile certification.*${status}`, 'i'));
      assert.match(summary.primaryBlockingFailure, /hostile certification/i);
      assert.equal(summary.playwright.passed, 1);
    } finally { fs.rmSync(fixture.runDir, { recursive: true, force: true }); }
  }
});

test('17.0.19 one-paste workflow reuses a verified same-version commit instead of creating an empty commit', () => {
  const workflow = fs.readFileSync(path.join(root, 'RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1'), 'utf8');
  assert.match(workflow, /SameVersionResume = \$true/);
  assert.match(workflow, /ResumeExistingCommit = \$true/);
  assert.match(workflow, /HEAD:release-source-manifest\.json/);
  assert.match(workflow, /headManifestHash -ne \$workingManifestHash/);
  assert.match(workflow, /Empty commit will not be created/);
  assert.match(workflow, /if \(-not \$script:ResumeExistingCommit\) \{\s*Invoke-Git @\('commit'/s);
  assert.match(workflow, /origin\/testing already points to/);
  assert.match(workflow, /merge-base --is-ancestor/);
  assert.match(workflow, /wait for exact Vercel deployment/);
});

test('17.0.19 PowerShell final success is gated by a parseable green collector verdict', () => {
  const gate = fs.readFileSync(path.join(root, 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'), 'utf8');
  assert.match(gate, /CollectorExit = Run-CollectorStep/);
  assert.match(gate, /Collector summary is malformed because the required ok verdict is missing/);
  assert.match(gate, /CollectorSummary\.ok -ne \$true/);
  assert.match(gate, /RunnerState\.finalExitCode = if \(\$RunnerState\.status -eq 'passed'\) \{ 0 \} else \{ 1 \}/);
  const success = gate.indexOf('Release gate passed.');
  const finalCheck = gate.indexOf('if ([int]$RunnerState.finalExitCode -ne 0)');
  assert.ok(finalCheck > 0 && success > finalCheck);
});
