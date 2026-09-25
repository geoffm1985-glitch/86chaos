'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

test('17.1.17 footer binds current version and copyright into one explicit app identity line', () => {
  const app = read('src/App.js');
  const currentVersion = json('package.json').version;
  assert.equal(json('public/version.json').version, currentVersion);
  assert.ok(read('src/core/appCore.js').includes(`CURRENT_VERSION = '${currentVersion}'`));
  assert.match(app, /data-testid="app-version-copyright"/);
  assert.match(app, /Version \{CURRENT_VERSION\} • © 2026 Chilton App Works LLC/);
  assert.match(app, /className="app-version-copyright[^"]*text-center/);
});

test('17.1.17 full Play Store runner keeps testing default and supports exact experimental certification', () => {
  const runner = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
  assert.match(runner, /\$CanonicalTestingUrl = 'https:\/\/testing\.86chaos\.com'/);
  assert.match(runner, /\$CanonicalExperimentalUrl = 'https:\/\/experimental\.86chaos\.com'/);
  assert.match(runner, /if \(-not \$ExpectedBranch\) \{ \$ExpectedBranch = 'testing' \}/);
  assert.match(runner, /\$ExpectedBranch -notin @\('testing', 'experimental'\)/);
  assert.match(runner, /CHAOS_RELEASE_GATE_TARGET_URL/);
  assert.match(runner, /SetEnvironmentVariable\('CHAOS_EXPECTED_BRANCH', \$ExpectedBranch, 'Process'\)/);
  assert.match(runner, /\$env:APP_URL = \$ResolvedReleaseTargetUrl/);
  assert.match(runner, /\$env:CHAOS_BASE_URL = \$ResolvedReleaseTargetUrl/);
});

test('17.1.17 current release scope includes Play Store footer coverage for desktop and mobile', () => {
  const scope = read('scripts/86chaos-release-gate/current-release-repair-scope.cjs');
  assert.match(scope, /const CURRENT_RELEASE_VERSION = '17\.1\.17'/);
  assert.match(scope, /31-footer-version-copyright\.spec\.cjs/);
  assert.match(scope, /footer shows the current version together with the copyright on desktop/);
  assert.match(scope, /footer identity remains reachable on mobile above the fixed bottom toolbar/);
});
