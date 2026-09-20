'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

test('17.0.25 release preflight verifies the stable Firebase/Auth browser alias against the immutable deployment', () => {
  const source = read('scripts/86chaos-release-gate/preflight-env.cjs');
  assert.match(source, /approvedBrowserTestUrl = firebaseAuthReferrerUrl\(\)/);
  assert.match(source, /aliasServer\.vercelDeploymentId/);
  assert.match(source, /serverBuildIdentity\.vercelDeploymentId/);
  assert.match(source, /aliasManifest/);
  assert.match(source, /resolvedBrowserTestUrl: browserAliasIdentityVerified \? approvedBrowserTestUrl : ''/);
  assert.match(source, /Refusing to start Playwright/);
});

test('17.0.25 keeps immutable certification URL separate from the Firebase-approved browser URL', () => {
  const gate = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
  const switchIndex = gate.indexOf('$BrowserTestUrl = [string]$PreflightReport.resolvedBrowserTestUrl');
  const playwrightIndex = gate.indexOf('Run-LiveStep "Playwright release gate"');
  assert.ok(switchIndex > 0 && playwrightIndex > switchIndex);
  assert.match(gate, /\$env:CHAOS_IMMUTABLE_VERCEL_URL = \$PinnedDeploymentUrl\.TrimEnd\('\/'\)/);
  assert.match(gate, /\$env:APP_URL = \$env:CHAOS_IMMUTABLE_VERCEL_URL/);
  assert.match(gate, /\$env:CHAOS_BASE_URL = \$env:CHAOS_IMMUTABLE_VERCEL_URL/);
  assert.match(gate, /\$env:CHAOS_BROWSER_BASE_URL = \$BrowserTestUrl\.TrimEnd\('\/'\)/);
  assert.match(gate, /\$env:PLAYWRIGHT_BASE_URL = \$env:CHAOS_BROWSER_BASE_URL/);
  assert.doesNotMatch(gate.slice(switchIndex, playwrightIndex), /\$env:APP_URL = \$BrowserTestUrl/);
});

test('17.0.25 browser-facing Playwright helpers prefer the stable auth alias over immutable APP_URL', () => {
  for (const rel of [
    'playwright.play-store-release.config.cjs',
    'playwright.failed-release.config.cjs',
    'playwright.inventory.config.cjs',
    'playwright.config.js',
  ]) {
    const source = read(rel);
    assert.match(source, /CHAOS_BROWSER_BASE_URL/ , `${rel} must honor CHAOS_BROWSER_BASE_URL`);
    const browserIndex = source.indexOf('CHAOS_BROWSER_BASE_URL');
    const appIndex = source.indexOf('APP_URL');
    assert.ok(browserIndex >= 0 && appIndex > browserIndex, `${rel} must prefer browser alias before APP_URL`);
  }
  const audit = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
  assert.match(audit, /envValue\('CHAOS_BROWSER_BASE_URL', 'PLAYWRIGHT_BASE_URL', 'APP_URL'/);
  const chunk = read('tests/e2e/chunk-recovery.spec.cjs');
  assert.match(chunk, /process\.env\.CHAOS_BROWSER_BASE_URL \|\| process\.env\.PLAYWRIGHT_BASE_URL \|\| process\.env\.APP_URL/);
});

test('17.0.25 failed-only runner also pins browser navigation to the approved testing alias', () => {
  const gate = read('RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1');
  assert.match(gate, /CHAOS_BROWSER_BASE_URL/);
  assert.match(gate, /approved browser Firebase Auth testing alias/);
  assert.match(gate, /\$CanonicalFirebaseAuthReferrerUrl/);
});
