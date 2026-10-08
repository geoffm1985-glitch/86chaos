'use strict';

function text(value) { return String(value == null ? '' : value).trim(); }
function walkSuites(suites = [], output = []) {
  for (const suite of Array.isArray(suites) ? suites : []) {
    for (const spec of suite.specs || []) for (const test of spec.tests || []) {
      const attempts = Array.isArray(test.results) ? test.results : [];
      const finalAttempt = attempts[attempts.length - 1] || null;
      output.push({ title:[suite.title,spec.title,test.title].filter(Boolean).join(' > '), project:test.projectName || '', attempts:attempts.length, retries:Math.max(0, attempts.length - 1), finalStatus:finalAttempt?.status || 'not-run', durationMs:attempts.reduce((sum,row) => sum + Number(row.duration || 0),0), interrupted:attempts.some(row => row.status === 'interrupted'), timedOut:finalAttempt?.status === 'timedOut' });
    }
    walkSuites(suite.suites || [], output);
  }
  return output;
}

function summarizePlaywrightTruth(report = null) {
  if (!report || typeof report !== 'object') return { started:false, completed:false, total:0, pass:0, fail:0, timeout:0, skip:0, interrupted:0, retries:0, tests:[] };
  const tests = walkSuites(report.suites || []);
  const errors = Array.isArray(report.errors) ? report.errors.filter(Boolean) : [];
  return {
    started:tests.length > 0,
    completed:tests.length > 0 && tests.every(row => row.finalStatus !== 'not-run' && !row.interrupted) && errors.length === 0,
    total:tests.length,
    pass:tests.filter(row => row.finalStatus === 'passed').length,
    fail:tests.filter(row => !['passed','skipped','timedOut'].includes(row.finalStatus)).length,
    timeout:tests.filter(row => row.timedOut).length,
    skip:tests.filter(row => row.finalStatus === 'skipped').length,
    interrupted:tests.filter(row => row.interrupted).length,
    retries:tests.reduce((sum,row) => sum + row.retries,0),
    reportErrors:errors.length,
    tests
  };
}

function sameIdentity(expected = {}, actual = {}, label, failures) {
  for (const key of ['version','commit','sourceHash','deploymentId','deploymentUrl','firebaseProject','branch']) {
    const expectedValue = text(expected[key]);
    const actualValue = text(actual[key]);
    if (expectedValue && !actualValue) failures.push(`${label} ${key} is missing.`);
    else if (expectedValue && expectedValue !== actualValue) failures.push(`${label} ${key} is stale or mismatched.`);
  }
}

function evaluateCertificationTruth(input = {}) {
  const failures = [];
  const mode = text(input.mode || 'full').toLowerCase();
  const runner = input.runner || {};
  const playwright = summarizePlaywrightTruth(input.playwrightReport || null);
  const expectedSourceIdentity=input.expectedSourceIdentity || input.expectedIdentity || {};
  const expectedDeploymentIdentity=input.expectedDeploymentIdentity || input.expectedIdentity || {};
  sameIdentity(expectedSourceIdentity, input.sourceIdentity || {}, 'Source identity', failures);
  sameIdentity(expectedDeploymentIdentity, input.deploymentIdentity || {}, 'Deployment identity', failures);
  const artifact = input.artifact || {};
  if (artifact.runId && runner.runId && text(artifact.runId) !== text(runner.runId)) failures.push('Release artifact belongs to a stale run.');
  if (artifact.version && expectedSourceIdentity.version && text(artifact.version) !== text(expectedSourceIdentity.version)) failures.push('Release artifact belongs to a stale version.');
  if (artifact.sourceHash && expectedSourceIdentity.sourceHash && text(artifact.sourceHash) !== text(expectedSourceIdentity.sourceHash)) failures.push('Release artifact belongs to stale source.');
  if (mode === 'full') {
    if (runner.playwrightStarted !== true || !playwright.started) failures.push('Full gate did not prove Playwright start.');
    if (runner.playwrightCompleted !== true || !playwright.completed) failures.push('Full gate did not prove Playwright completion.');
    if (playwright.fail || playwright.timeout || playwright.interrupted) failures.push('Full gate contains failed, timed-out, or interrupted Playwright results.');
  }
  if (runner.finalExitCode != null && Number(runner.finalExitCode) !== 0) failures.push('Release runner exit code is non-zero.');
  if (runner.blockingReason) failures.push(`Release runner blocked: ${text(runner.blockingReason)}`);
  return { schemaVersion:1, ok:failures.length === 0, mode, failures, playwright, retryAccounting:{ retries:playwright.retries, finalAttemptWins:true }, timeoutAccounting:{ timedOut:playwright.timeout, interrupted:playwright.interrupted }, partialRunCanCertify:mode === 'full', staleEvidenceRejected:true };
}

module.exports = { walkSuites, summarizePlaywrightTruth, evaluateCertificationTruth };
