'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('chunk recovery regression uses logical automatic recovery state, not brittle navigation delta', () => {
  const source = read('tests/e2e/chunk-recovery.spec.cjs');
  assert.match(source, /automaticRecoveryAttempts|autoRecoveryStarted|auto-recovery-started|recoveryState/);
  assert.match(source, /<=\s*1|toBeLessThanOrEqual\(1\)/);
  assert.doesNotMatch(source, /topLevelNavigations\s*-\s*baselineNavigations\s*===\s*1/);
  assert.doesNotMatch(source, /topLevelNavigations\s*-\s*baselineNavigations\s*,\s*1/);
});
