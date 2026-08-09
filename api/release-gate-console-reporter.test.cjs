'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Reporter = require('../test-tools/reporters/chaos-release-gate-reporter.cjs');

function fakeTest(title, project = 'chromium', file = 'tests/e2e/example.spec.cjs', parents = []) {
  return {
    title,
    location: { file },
    projectName: project,
    project: () => ({ name: project }),
    titlePath: () => [project, path.basename(file), ...parents, title],
  };
}

function outputHasOnlyAscii(lines) {
  return lines.every(line => /^[\x09\x0A\x0D\x20-\x7E]*$/.test(line));
}

test('release-gate reporter prints selected manifest once and one result line per executed test', () => {
  const lines = [];
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-reporter-'));
  const selection = {
    totalSelected: 3,
    desktopSelected: 2,
    mobileSelected: 1,
    previousFailuresSelected: 1,
    previousTimeoutsSelected: 0,
    currentReleaseFeatureTestsSelected: 2,
    duplicateIdentitiesRemoved: 0,
    selected: [
      { project: 'chromium', specPath: 'tests/e2e/a.spec.cjs', fullSuitePath: 'system-admin', title: 'opens every permitted primary surface without runtime or layout failure' },
      { project: 'chromium', specPath: 'tests/e2e/b.spec.cjs', fullSuitePath: 'owner', title: 'opens every permitted primary surface without runtime or layout failure' },
      { project: 'mobile-chromium', specPath: 'tests/e2e/c.spec.cjs', fullSuitePath: 'Schedule Builder', title: 'coverage warnings show under and over target math' },
    ],
  };
  const reporter = new Reporter({ output: line => lines.push(line), runDir, mode: 'repair', version: '16.0.158', selection });
  const suite = { allTests: () => [1, 2, 3] };
  reporter.onBegin({}, suite);
  reporter.onBegin({}, suite);
  reporter.onTestEnd(fakeTest('first test'), { status: 'passed', duration: 1200 });
  reporter.onTestEnd(fakeTest('second test'), { status: 'failed', duration: 2200, error: { message: 'Expected useful thing to be visible.\n    at noisy stack' }, outputDir: 'test-results/example-fail' });
  reporter.onTestEnd(fakeTest('third test', 'mobile-chromium'), { status: 'skipped', duration: 0 });

  assert.equal(lines.filter(line => line === '86 Chaos repair selected tests:').length, 1);
  assert.equal(lines.filter(line => /^\[(PASS|FAIL|SKIP|TIMEOUT)\]/.test(line)).length, 3);
  assert(lines.some(line => line.startsWith('[PASS] 01/3 chromium')));
  assert(lines.some(line => line.startsWith('[FAIL] 02/3 chromium')));
  assert(lines.some(line => line.startsWith('[SKIP] 03/3 mobile-chromium')));
  assert(lines.some(line => line === 'FAILED TEST'));
  assert(outputHasOnlyAscii(lines), 'console output is ASCII-only for normal PowerShell');
});

test('release-gate reporter renders duplicate leaf titles with role or describe path', () => {
  const title = Reporter.humanTestTitle(fakeTest('opens every permitted primary surface without runtime or layout failure', 'chromium', 'tests/e2e/authenticated-release.spec.cjs', ['system-admin']));
  assert.match(title, /system-admin \| opens every permitted primary surface without runtime or layout failure/);
});

test('summary and failed artifact reconcile totals and include only failures or timeouts', () => {
  const results = [
    { project: 'chromium', file: 'tests/a.spec.cjs', title: 'passes', status: 'passed', duration: 1000 },
    { project: 'chromium', file: 'tests/b.spec.cjs', title: 'fails', status: 'failed', error: 'Expected text to be visible.' },
    { project: 'mobile-chromium', file: 'tests/c.spec.cjs', title: 'times out', status: 'timedOut', error: 'Timeout 90000ms exceeded.' },
    { project: 'mobile-chromium', file: 'tests/d.spec.cjs', title: 'skips', status: 'skipped' },
  ];
  const summary = Reporter.createCompletedSummaryLines({ results, mode: 'repair', runDir: 'test-results/run' }).join('\n');
  const failed = Reporter.createFailedTestsArtifactLines({ results, runId: 'run-1', version: '16.0.158', mode: 'repair' }).join('\n');

  assert.match(summary, /TOTAL:\s+4/);
  assert.match(summary, /PASS:\s+1/);
  assert.match(summary, /FAIL:\s+1/);
  assert.match(summary, /TIMEOUT:\s+1/);
  assert.match(summary, /SKIP:\s+1/);
  assert.match(summary, /RESULT: FAILED/);
  assert.match(failed, /fails/);
  assert.match(failed, /times out/);
  assert.doesNotMatch(failed, /passes/);
  assert.doesNotMatch(failed, /skips/);
});

test('ASCII labels render without PowerShell mojibake-prone symbols', () => {
  assert.equal(Reporter.statusLabel('passed'), 'PASS');
  assert.equal(Reporter.statusLabel('failed'), 'FAIL');
  assert.equal(Reporter.statusLabel('skipped'), 'SKIP');
  assert.equal(Reporter.statusLabel('timedOut'), 'TIMEOUT');
  const line = Reporter.createResultLine({ status: 'timedOut', current: 4, total: 4, project: 'mobile-chromium', title: 'cost scenario manager-schedule-builder', duration: 90000 });
  assert.equal(line, '[TIMEOUT] 04/4 mobile-chromium | cost scenario manager-schedule-builder | 1m 30s');
  assert(outputHasOnlyAscii([line]));
});

test('interrupted run summary is explicitly non-authoritative', () => {
  const lines = Reporter.createInterruptedSummaryLines({ completed: 17, total: 44, counts: { passed: 14, failed: 2, skipped: 1 } });
  const text = lines.join('\n');
  assert.match(text, /86 CHAOS TEST RUN INTERRUPTED/);
  assert.match(text, /THIS RUN IS NOT AUTHORITATIVE/);
  assert.match(text, /will not replace completed failed-only lineage/);
  assert.doesNotMatch(text, /86 CHAOS TEST RESULT/);
  assert(outputHasOnlyAscii(lines));
});

test('reporter writes human summary artifacts on completed run', () => {
  const lines = [];
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-reporter-completed-'));
  const reporter = new Reporter({ output: line => lines.push(line), runDir, mode: 'repair', version: '16.0.158', selection: { totalSelected: 1, selected: [] } });
  reporter.onBegin({}, { allTests: () => [1] });
  reporter.onTestEnd(fakeTest('passes'), { status: 'passed', duration: 100 });
  reporter.onEnd({ status: 'passed' });
  const summary = fs.readFileSync(path.join(runDir, 'TEST-SUMMARY.txt'), 'utf8');
  const failed = fs.readFileSync(path.join(runDir, 'FAILED-TESTS.txt'), 'utf8');
  assert.match(summary, /RESULT: PASSED/);
  assert.match(failed, /No failed or timed-out tests/);
  assert(outputHasOnlyAscii(lines));
});

test('release-gate config keeps JSON artifacts and manifest selection semantics intact', () => {
  const failedConfig = fs.readFileSync(path.join(process.cwd(), 'playwright.failed-release.config.cjs'), 'utf8');
  assert.match(failedConfig, /chaos-release-gate-reporter\.cjs/);
  assert.match(failedConfig, /\['json', \{ outputFile: path\.join\(runDir, 'playwright-report\.json'\) \}\]/);
  assert.match(failedConfig, /testMatch: specsFromManifest\(FAILED_ONLY_TESTS\)/);
  assert.match(failedConfig, /grep: grepForProject\(FAILED_ONLY_TESTS, 'chromium'\)/);
  assert.doesNotMatch(failedConfig, /console\.log\(`86 Chaos \$\{releaseSelectionMode\} selected tests:`\)/);
});
