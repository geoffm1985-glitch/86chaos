'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { validateReleaseSkips } = require('../scripts/86chaos-release-gate/expected-skips.cjs');
const { captureSourceIdentity } = require('../scripts/86chaos-release-gate/source-identity.cjs');
const evidence = require('../test-tools/fixtures/release-gate-16-0-229-results.json');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const rows = () => evidence.rows.map(row => ({ ...row, title: [...row.suitePath, row.leafTitle].join(' > '), annotations: row.annotations.map(annotation => ({ ...annotation })) }));

test('the supplied full 16.0.229 run has seven intentional skips and all required companion coverage passed', () => {
  const results = rows();
  assert.equal(results.length, 255);
  assert.equal(results.filter(row => row.status === 'passed').length, 248);
  const validation = validateReleaseSkips(results);
  assert.equal(validation.ok, true);
  assert.equal(validation.expected.length, 7);
  assert.deepEqual(validation.unexpected, []);
  assert.ok(validation.expected.every(row => row.reason && row.coverage.length));
});

test('a new skipped identity is a blocker even with a known skip reason', () => {
  const results = rows();
  results.push({ ...results.find(row => row.status === 'skipped'), title: 'A future test with real coverage requirements' });
  const validation = validateReleaseSkips(results);
  assert.equal(validation.ok, false);
  assert.equal(validation.expected.length, 7);
  assert.match(validation.unexpected[0].reason, /not an approved/);
});

test('responsive duplicate skips require the same viewport to pass in Chromium in this run', () => {
  const results = rows().filter(row => !(row.projectName === 'chromium' && row.title.endsWith('[phone]')));
  const validation = validateReleaseSkips(results);
  assert.equal(validation.ok, false);
  assert.equal(validation.unexpected.length, 1);
  assert.match(validation.unexpected[0].title, /\[phone\]$/);
  assert.match(validation.unexpected[0].reason, /companion coverage/);
});

test('a skip with a missing or different annotation remains blocked', () => {
  for (const annotations of [[], [{ type: 'skip', description: 'Missing required QA credentials' }]]) {
    const results = rows();
    results.find(row => row.status === 'skipped').annotations = annotations;
    assert.equal(validateReleaseSkips(results).ok, false);
  }
});

test('System Administrator exemptions require a nonempty canonical matrix with no denied routes', () => {
  for (const systemAdminRoutes of [[], [{ directNavigationAllowed: false }], [{ route: 'unknown' }]]) {
    const validation = validateReleaseSkips(rows(), { systemAdminRoutes });
    assert.equal(validation.ok, false);
    assert.equal(validation.unexpected.length, 2);
    assert.ok(validation.unexpected.every(row => /canonical System Administrator/.test(row.reason)));
  }
});

test('System Administrator exemptions require permitted surfaces and other roles denial checks to pass', () => {
  for (const suffix of [
    'system-admin authenticated release surfaces > opens every permitted primary surface without runtime or layout failure',
    'staff authenticated release surfaces > direct navigation follows the canonical denied-route matrix',
  ]) {
    const results = rows().filter(row => !(row.projectName === 'chromium' && row.title === suffix));
    const validation = validateReleaseSkips(results);
    assert.equal(validation.ok, false);
    assert.equal(validation.unexpected.length, 1);
    assert.equal(validation.unexpected[0].projectName, 'chromium');
  }
});

test('a duplicate intentional skip, wrong project or wrong role cannot expand the exception set', () => {
  const results = rows();
  const skipped = results.find(row => row.status === 'skipped');
  for (const extra of [skipped, { ...skipped, projectName: 'firefox-pwa' }, {
    ...results.find(row => row.status === 'skipped' && row.file.startsWith('e2e/')),
    title: 'owner authenticated release surfaces > direct navigation follows the canonical denied-route matrix',
  }]) {
    assert.equal(validateReleaseSkips([...results, extra]).ok, false);
  }
});

test('failed, timed-out, skipped or interrupted companion runs never justify an intentional skip', () => {
  for (const status of ['failed', 'timedOut', 'skipped', 'interrupted']) {
    const results = rows();
    results.find(row => row.projectName === 'chromium' && row.title.endsWith('[tablet]')).status = status;
    assert.equal(validateReleaseSkips(results).ok, false);
  }
});

function collectFixture({ results = rows(), staleSource = false, preflightFailed = false } = {}) {
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  const runDir = fs.mkdtempSync(path.join(root, 'test-results', 'unit-expected-skips-'));
  const runId = path.basename(runDir);
  const write = (name, value) => fs.writeFileSync(path.join(runDir, name), JSON.stringify(value));
  const common = { ok: true, runId };
  try {
    write('runner-state.json', { ...common, mode: 'full', playwrightStarted: true, dependencyInstallAttempted: true, dependencyInstallPassed: true,
      rolePreflightStarted: true, rolePreflightPassed: true, qaSeedAttempted: true, qaSeedVerified: true, cleanupAttempted: true, cleanupCompleted: true, currentPhase: 'report-collection' });
    write('environment-preflight.json', { ...common, expectedVersion: version, sourceVersion: version, deployedVersion: version,
      ...(preflightFailed ? { ok: false, errors: ['Fixture environment preflight failed.'] } : {}) });
    write('source-inventory.json', { ...common, version, packageVersion: version });
    for (const name of ['dependency-preflight.json', 'server-firebase-boundary-preflight.json', 'test-account-provisioning.json', 'role-identity-verification.json', 'java-prerequisite.json', 'node-test-live-summary.json', 'firebase-rules-release-gate.json']) write(name, common);
    write('qa-setup-state.json', { ...common, attempted: true, verified: true, seeded: true });
    write('86chaos-full-audit-seed-report.json', { ...common, restaurantId: 'qa_unit', verification: { ok: true } });
    write('86chaos-full-audit-cleanup-report.json', { ...common, remaining: {}, accountedFailures: [] });
    write('source-identity-start.json', { ...captureSourceIdentity(root), ...(staleSource ? { sourceHash: 'changed-source-fixture' } : {}) });
    write('playwright-report.json', {
      config: { rootDir: path.join(root, 'tests') }, errors: [],
      suites: results.map(row => ({ title: row.file.replace(/\//g, '\\'), specs: [], suites: [{
        title: row.suitePath.join(' > '), suites: [], specs: [{ title: row.leafTitle, file: row.file,
          tests: [{ projectName: row.projectName, expectedStatus: row.status === 'skipped' ? 'skipped' : 'passed',
            annotations: row.annotations, results: [{ status: row.status, duration: 1 }] }],
        }],
      }] })),
    });
    execFileSync(process.execPath, ['scripts/86chaos-release-gate/collect-release-gate-report.cjs'], {
      cwd: root, stdio: 'pipe', timeout: 20000,
      env: { ...process.env, CHAOS_RELEASE_GATE_RUN_ID: runId, CHAOS_RELEASE_GATE_RUN_DIR: runDir,
        CHAOS_RELEASE_GATE_SELECTION_MODE: 'full', CHAOS_FAILED_ONLY_RELEASE_GATE: 'false', CHAOS_FAILED_AND_NEW_RELEASE_GATE: 'false',
        CHAOS_RELEASE_GATE_STEP_FAILURES: '0', CHAOS_EXPECTED_VERSION: version },
    });
    return { summary: JSON.parse(fs.readFileSync(path.join(runDir, `86chaos-play-store-release-gate-summary-${version}-${runId}.json`), 'utf8')),
      text: fs.readFileSync(path.join(runDir, 'TEST-SUMMARY.txt'), 'utf8'), failures: fs.readFileSync(path.join(runDir, 'FAILED-TESTS.txt'), 'utf8') };
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
  }
}

test('actual collector reconciles the 248 PASS / 7 intentional SKIP fixture without changing any test result', () => {
  const { summary, text } = collectFixture();
  assert.equal(summary.ok, true);
  assert.equal(summary.fullReleaseCertified, true);
  assert.equal(summary.playwright.totalResults, 255);
  assert.equal(summary.playwright.passed, 248);
  assert.equal(summary.playwright.failed, 0);
  assert.equal(summary.playwright.timedOut, 0);
  assert.equal(summary.playwright.skipped, 7);
  assert.equal(summary.skipValidation.expected.length, 7);
  assert.match(text, /RESULT: PASSED/);
  assert.match(text, /Expected skips with verified coverage: 7/);
  assert.match(text, /Unexpected skips: 0/);
});

test('actual collector explains an unexpected skip and directs a full rerun instead of claiming no action is needed', () => {
  const results = rows();
  const extra = { ...results[0], status: 'skipped', annotations: [], leafTitle: 'An unexpected skipped test' };
  const { summary, text, failures } = collectFixture({ results: [...results, extra] });
  assert.equal(summary.ok, false);
  assert.equal(summary.fullReleaseCertified, false);
  assert.equal(summary.playwright.skipped, 8);
  assert.equal(summary.skipValidation.unexpected.length, 1);
  assert.match(summary.primaryBlockingFailure, /Unexpected skipped test/);
  assert.match(text, /RESULT: FAILED/);
  assert.match(text, /Next command:.*npm run test:play-store/);
  assert.doesNotMatch(text, /Next command: None/);
  assert.match(failures, /Release gate blocker: Unexpected skipped test/);
});

test('expected skips never override source drift or environment failure', () => {
  for (const options of [{ staleSource: true }, { preflightFailed: true }]) {
    const { summary } = collectFixture(options);
    assert.equal(summary.skipValidation.ok, true);
    assert.equal(summary.ok, false);
    assert.equal(summary.fullReleaseCertified, false);
    assert.ok(summary.primaryBlockingFailure);
  }
});

test('expected skips never turn an actual failed or timed-out test into a pass', () => {
  for (const status of ['failed', 'timedOut']) {
    const results = rows();
    results[0].status = status;
    const { summary } = collectFixture({ results });
    assert.equal(summary.ok, false);
    assert.equal(summary.fullReleaseCertified, false);
    assert.equal(summary.playwright.failed + summary.playwright.timedOut, 1);
  }
});
