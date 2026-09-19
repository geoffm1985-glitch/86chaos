'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Reporter = require('../test-tools/reporters/chaos-release-gate-reporter.cjs');

function fakeTest(id, title, retries = 0) {
  return { id, title, retries, timeout: 45000, location: { file: `tests/${id}.spec.cjs` }, project: () => ({ name: 'mobile-chromium' }), titlePath: () => ['mobile-chromium', `${id}.spec.cjs`, 'Schedule Builder', title] };
}

test('17.0.11 overall and individual progress disclose real counters and elapsed-vs-timeout semantics', () => {
  const overall = Reporter.overallProgressLines({ completed: 179, total: 281, counts: { passed: 174, failed: 2, skipped: 3, timedOut: 0 }, elapsedMs: 1902000, title: 'publish selected weeks', project: 'mobile-chromium', attempt: 1 }).join('\n');
  assert.match(overall, /179 \/ 281 tests complete/);
  assert.match(overall, /64%/);
  assert.match(overall, /PASS: 174 \| FAIL: 2 \| SKIP: 3 \| TIMEOUT: 0/);
  assert.match(overall, /mobile-chromium/);
  const individual = Reporter.individualProgressLine({ elapsedMs: 18400, timeoutMs: 45000, title: 'publish selected weeks', project: 'mobile-chromium', attempt: 2 });
  assert.match(individual, /ELAPSED VS TIMEOUT/);
  assert.match(individual, /18s \/ 45s/);
  assert.match(individual, /attempt 2/);
  assert.doesNotMatch(individual, /complete/i);
});

test('17.0.11 retries do not double-count final Playwright progress and duration evidence preserves attempts', async () => {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-progress-1711-'));
  const lines = [];
  try {
    const first = fakeTest('schedule', 'renders legacy schedule', 1);
    const second = fakeTest('other', 'skipped example', 0);
    const reporter = new Reporter({ runDir, root: path.resolve(__dirname, '..'), output: line => lines.push(line), heartbeatMs: 0, interactive: false, includeIdentities: false });
    reporter.onBegin({}, { allTests: () => [first, second] });
    reporter.onTestBegin(first, { retry: 0 });
    reporter.onTestEnd(first, { retry: 0, status: 'failed', duration: 100, error: { message: 'first attempt' }, attachments: [] });
    assert.equal(reporter.completed, 0);
    assert.deepEqual(reporter.counts, { passed: 0, failed: 0, timedOut: 0, skipped: 0, interrupted: 0 });
    reporter.onTestBegin(first, { retry: 1 });
    reporter.onTestEnd(first, { retry: 1, status: 'passed', duration: 80, attachments: [] });
    reporter.onTestBegin(second, { retry: 0 });
    reporter.onTestEnd(second, { retry: 0, status: 'skipped', duration: 5, attachments: [] });
    await reporter.onEnd({ status: 'passed' });
    assert.equal(reporter.completed, 2);
    assert.equal(reporter.counts.passed, 1);
    assert.equal(reporter.counts.failed, 0);
    assert.equal(reporter.counts.skipped, 1);
    assert.match(lines.join('\n'), /Retry scheduled/);
    const evidence = JSON.parse(fs.readFileSync(path.join(runDir, 'playwright-duration-evidence.json'), 'utf8'));
    assert.equal(evidence.totalDiscovered, 2);
    assert.equal(evidence.totalCompleted, 2);
    assert.equal(evidence.tests[0].attempts.length, 2);
    assert.equal(evidence.tests[0].totalDurationMs, 180);
  } finally { fs.rmSync(runDir, { recursive: true, force: true }); }
});

test('17.0.11 non-TTY reporter emits line-oriented timing without carriage-return output', () => {
  const lines = [];
  const reporter = new Reporter({ output: line => lines.push(line), heartbeatMs: 0, interactive: false, includeIdentities: false });
  const row = fakeTest('line', 'line output');
  reporter.onBegin({}, { allTests: () => [row] });
  reporter.onTestBegin(row, { retry: 0 });
  reporter.onTestEnd(row, { retry: 0, status: 'passed', duration: 1 });
  reporter.onEnd({ status: 'passed' });
  assert(lines.some(line => /ELAPSED VS TIMEOUT/.test(line)));
  assert(lines.every(line => !line.includes('\r')));
});
