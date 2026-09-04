'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('16.0.205 reported-failed-only guard accepts the actual six selected legacy failure identities', () => {
  const config = read('playwright.failed-release.config.cjs');
  assert.match(config, /if \(rows\.length !== 6\) errors\.push\(`expected 6 selected FAIL identities, got \$\{rows\.length\}`\);/);
  assert.match(config, /if \(desktop !== 2\) errors\.push\(`expected 2 chromium identities, got \$\{desktop\}`\);/);
  assert.match(config, /if \(mobile !== 4\) errors\.push\(`expected 4 mobile-chromium identities, got \$\{mobile\}`\);/);
  const failedOnlyGuard = config.slice(config.indexOf('function assertReportedFailedOnlySelection'), config.indexOf('function assertReportedCurrentBlockersSelection'));
  assert.doesNotMatch(failedOnlyGuard, /expected 1 chromium identity/);
  assert.match(config, /duplicate stable identities selected/);
  assert.match(config, /reported-failed-only selected a timeout status/);
  assert.match(config, /previous_timeout\|timeout\|current_release_feature_test\|new_test\|repair/i);
});

test('16.0.205 failed-only config still refuses false-green zero-test selections', () => {
  const config = read('playwright.failed-release.config.cjs');
  assert.match(config, /if \(!FAILED_ONLY_TESTS\.length\) \{/);
  assert.match(config, /Failed-only manifest selected zero tests\. Refusing to run a false-green diagnostic gate/);
  assert.match(config, /throw new Error/);
});

test('16.0.205 validator remains archived after later version bumps', () => {
  const validator = read('scripts/validate-16-0-205.js');
  assert.match(validator, /16\.0\.205 source validation passed/);
  assert.match(validator, /reported-failed-only guard expects the actual 2 chromium \+ 4 mobile selected identities/);
  assert.match(validator, /failed-only config still refuses zero-test false-green runs/);
});
