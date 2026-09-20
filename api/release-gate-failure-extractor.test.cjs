'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractRulesPrimaryFailure,
  extractNodeTestFailure,
  firstUsefulFailureFromOutput,
  isSuccessfulLine,
} = require('../scripts/86chaos-release-gate/failure-extractor.cjs');

test('rules failure extractor skips intentional assertFails permission-denied diagnostics and reports later unexpected denial', () => {
  const output = [
    '→ Expected negative reminder denial',
    "[2026-08-07T02:27:40.346Z]  @firebase/firestore: Firestore (10.14.1): GrpcConnection RPC 'Write' stream error. Code: 7 Message: 7 PERMISSION_DENIED:",
    "evaluation error at L1089:18 for 'delete' @ L1089, false for 'delete' @ L1089",
    '→ Personal reminder canonical participant queries',
    '[FirebaseError: evaluation error at L1050:16 for list @ L1050, false for list @ L1050] {',
    "  code: 'permission-denied'",
    '}',
    'Script exited unsuccessfully (code 1)',
  ].join('\n');
  const failure = extractRulesPrimaryFailure(output);
  assert.match(failure, /Personal reminder canonical participant queries/);
  assert.match(failure, /FirebaseError/);
  assert.doesNotMatch(failure, /Expected negative reminder denial/);
});

test('rules failure extractor reports no blocker for successful suite with expected permission-denied diagnostics only', () => {
  const output = [
    '→ Negative rule check',
    "[2026-08-07T02:27:40.346Z]  @firebase/firestore: Firestore (10.14.1): GrpcConnection RPC 'Write' stream error. Code: 7 Message: 7 PERMISSION_DENIED:",
    "false for 'update' @ L1047",
    'PASS invoice upload with mismatched metadata is denied',
    '+ Script exited successfully (code 0)',
  ].join('\n');
  assert.equal(extractRulesPrimaryFailure(output), '');
  assert.equal(firstUsefulFailureFromOutput({ status: 0, stdout: output, stderr: '' }), '');
});

test('successful lines with scary words are never primary failures', () => {
  for (const line of [
    '✔ rules failure extractor skips intentional failures',
    '✔ timeout classification handles locator timeout correctly',
    '✔ permission denied parser ignores expected diagnostics',
    'PASS error recovery test',
    'ok 1 - failed wording inside a passing TAP test',
  ]) {
    assert.equal(isSuccessfulLine(line), true, `${line} is a successful test line`);
    assert.equal(firstUsefulFailureFromOutput({ status: 0, stdout: line, stderr: '' }), '');
  }
});

test('node failure extractor ignores a passing rules failure test and selects later PWA assertion failure', () => {
  const output = [
    '✔ rules failure extractor skips intentional assertFails permission-denied diagnostics and reports later unexpected denial',
    '✔ timeout classification handles locator timeout correctly',
    '✔ permission denied parser ignores expected diagnostics',
    '✖ failing tests:',
    '',
    'test at api\\pwa-public-url-normalization.test.cjs:6:1',
    '✖ PWA icon source paths normalize PUBLIC_URL and root-relative forms',
    'AssertionError [ERR_ASSERTION]',
    "+ actual - expected",
  ].join('\n');
  const failure = firstUsefulFailureFromOutput({ status: 1, stdout: output, stderr: '' });
  assert.match(failure, /api\\pwa-public-url-normalization\.test\.cjs/);
  assert.match(failure, /PWA icon source paths normalize PUBLIC_URL and root-relative forms/);
  assert.match(failure, /AssertionError \[ERR_ASSERTION\]/);
  assert.doesNotMatch(failure, /rules failure extractor/);
});

test('node failure extractor selects later failing test after successful failure-word title', () => {
  const output = [
    '✔ successful title mentions failure but passed',
    '✔ successful title mentions timeout but passed',
    '✖ failing tests:',
    'test at api\\real-failure.test.cjs:10:1',
    '✖ later actual failing test',
    'AssertionError [ERR_ASSERTION]',
  ].join('\n');
  const failure = firstUsefulFailureFromOutput({ status: 1, stdout: output, stderr: '' });
  assert.match(failure, /later actual failing test/);
  assert.doesNotMatch(failure, /successful title/);
});

test('node failure extractor returns empty firstUsefulFailure for zero exit with scary successful names', () => {
  const output = [
    '✔ error recovery test passes',
    '✔ timeout wording test passes',
    '✔ permission denied wording test passes',
    '# tests 3',
    '# pass 3',
  ].join('\n');
  assert.equal(firstUsefulFailureFromOutput({ status: 0, stdout: output, stderr: '' }), '');
});

test('node failure extractor reports real AssertionError when present', () => {
  const output = [
    '✖ failing tests:',
    'test at api\\assertion.test.cjs:4:1',
    '✖ real assertion breaks',
    'AssertionError [ERR_ASSERTION]: Expected values to be strictly equal',
  ].join('\n');
  const failure = extractNodeTestFailure(output);
  assert.match(failure, /real assertion breaks/);
  assert.match(failure, /AssertionError/);
});

test('node failure extractor reports real process fatal errors before tests', () => {
  const output = [
    'file:///repo/api/broken.test.cjs:1',
    'SyntaxError: Unexpected token',
  ].join('\n');
  const failure = firstUsefulFailureFromOutput({ status: 1, stdout: '', stderr: output });
  assert.match(failure, /SyntaxError: Unexpected token/);
});
