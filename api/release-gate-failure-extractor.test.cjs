'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractRulesPrimaryFailure, firstUsefulFailureFromOutput } = require('../scripts/86chaos-release-gate/failure-extractor.cjs');

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
