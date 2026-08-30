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

test('16.0.205 version metadata is consistent', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  const version = JSON.parse(read('public/version.json'));
  const apiVersion = read('api/_version.js');
  const appCore = read('src/core/appCore.js');
  assert.equal(pkg.version, '16.0.205');
  assert.equal(lock.version, '16.0.205');
  assert.equal(lock.packages[''].version, '16.0.205');
  assert.equal(pkg.scripts['test:source'], 'node scripts/validate-16-0-205.js');
  assert.equal(version.version, '16.0.205');
  assert.equal(version.build, '16.0.205');
  assert.match(apiVersion, /APP_VERSION = '16\.0\.205'/);
  assert.match(apiVersion, /SECURITY_SCHEMA_VERSION = '16\.0\.205'/);
  assert.match(appCore, /CURRENT_VERSION = '16\.0\.205'/);
});
