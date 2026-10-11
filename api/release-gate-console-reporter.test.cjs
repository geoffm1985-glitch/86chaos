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

test('dashboard keeps failures, timeouts and interruptions visible while progress advances', () => {
  const line = Reporter.createDashboardLine({ completed: 4, total: 8, elapsed: 59999, counts: { passed: 1, failed: 1, timedOut: 1, interrupted: 1 } });
  assert.match(line, /\[############............\] 50% \| 4\/8 \| elapsed 1m 00s/);
  assert.match(line, /PASS 1 FAIL 1 TIMEOUT 1 SKIP 0 INTERRUPTED 1/);
  assert.doesNotMatch(Reporter.createDashboardLine({ total: 0 }), /NaN|Infinity|100%/);
  assert(outputHasOnlyAscii([line]));
});

test('dashboard reports a running test and stops its timer after a failed run', () => {
  const lines = [];
  const reporter = new Reporter({ output: line => lines.push(line), mode: 'repair' });
  const current = fakeTest('slow test');
  reporter.onBegin({}, { allTests: () => [current] });
  reporter.onTestBegin(current, {});
  assert(lines.some(line => line.startsWith('[RUNNING] chromium | slow test')));
  reporter.onTestEnd(current, { status: 'timedOut', duration: 90000 });
  reporter.onEnd({ status: 'failed' });
  assert.equal(reporter.activeTests.size, 0);
  assert.equal(reporter.dashboardTimer, null);
  assert.match(lines.join('\n'), /TIMEOUT 1/);
  assert.match(lines.join('\n'), /RESULT: FAILED/);
});

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
  const reporter = new Reporter({ output: line => lines.push(line), runDir, mode: 'repair', version: '16.0.159', selection });
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
  const failed = Reporter.createFailedTestsArtifactLines({ results, runId: 'run-1', version: '16.0.159', mode: 'repair' }).join('\n');

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


test('blocked-before-execution summary does not claim that previous failures are cleared', () => {
  const summary = Reporter.createCompletedSummaryLines({
    results: [],
    mode: 'repair',
    runDir: 'test-results/run',
    nextCommand: 'npm run test:play-store:repair',
    resultOverride: 'BLOCKED BEFORE TEST EXECUTION',
    primaryBlockingFailure: 'Refusing unsafe repair manifest.',
    blockedBeforeTestExecution: true,
  }).join('\n');
  const failed = Reporter.createFailedTestsArtifactLines({
    results: [],
    runId: 'run-blocked',
    version: '16.0.159',
    mode: 'repair',
    blockedBeforeTestExecution: true,
    primaryBlockingFailure: 'Refusing unsafe repair manifest.',
  }).join('\n');

  assert.match(summary, /RESULT: BLOCKED BEFORE TEST EXECUTION/);
  assert.match(summary, /Not evaluated - Playwright did not start/);
  assert.match(summary, /Existing failed-test lineage was not cleared/);
  assert.match(summary, /rerun npm run test:play-store:repair/);
  assert.doesNotMatch(summary, /Remaining failures: 0/);
  assert.doesNotMatch(summary, /None - no failed tests remain/);
  assert.match(failed, /No Playwright test results were produced because the run was blocked before test execution/);
  assert.match(failed, /Existing failed-test lineage was not evaluated or cleared/);
  assert.doesNotMatch(failed, /No failed or timed-out tests\./);
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
  const reporter = new Reporter({ output: line => lines.push(line), runDir, mode: 'repair', version: '16.0.159', selection: { totalSelected: 1, selected: [] } });
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


test('global setup failure with zero tests is blocked and retains its actual error', () => {
  const lines=[],runDir=fs.mkdtempSync(path.join(os.tmpdir(),'86chaos-reporter-setup-'));
  const reporter=new Reporter({output:line=>lines.push(line),runDir,mode:'release'});
  reporter.onError({message:'HTTP 403: This account is inactive or unavailable.'});
  reporter.onBegin({}, {allTests:()=>[]});
  reporter.onEnd({status:'failed'});
  const summary=fs.readFileSync(path.join(runDir,'TEST-SUMMARY.txt'),'utf8');
  const failures=fs.readFileSync(path.join(runDir,'FAILED-TESTS.txt'),'utf8');
  assert.match(summary,/RESULT: BLOCKED BEFORE TEST EXECUTION/);
  assert.match(summary,/Primary blocker: HTTP 403/);
  assert.match(failures,/Existing failed-test lineage was not evaluated or cleared/);
  assert.doesNotMatch(summary,/RESULT: PASSED|Remaining failures: 0|None - no failed tests remain/);
});

test('run-level failure after a passing test cannot produce a passing summary', () => {
  const lines=[],reporter=new Reporter({output:line=>lines.push(line),mode:'repair'});
  reporter.onBegin({}, {allTests:()=>[fakeTest('passes')]});
  reporter.onTestEnd(fakeTest('passes'),{status:'passed',duration:1});
  reporter.onError({message:'Global teardown failed'});
  reporter.onEnd({status:'failed'});
  assert.match(lines.join('\n'),/RESULT: FAILED/);
  assert.doesNotMatch(lines.join('\n'),/RESULT: PASSED/);
});

test('zero executed tests cannot be certified by a passed runner status', () => {
  const lines=[],reporter=new Reporter({output:line=>lines.push(line),mode:'release'});
  reporter.onBegin({}, {allTests:()=>[]});
  reporter.onEnd({status:'passed'});
  assert.match(lines.join('\n'),/RESULT: BLOCKED BEFORE TEST EXECUTION/);
  assert.doesNotMatch(lines.join('\n'),/RESULT: PASSED|Remaining failures: 0/);
});
