'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('release login helper requires authenticated app shell and rejects login-logo readiness', () => {
  const helper = read('tests/e2e/utils/release-login-helper.cjs');
  assert.match(helper, /function waitForAuthenticatedShell/);
  assert.match(helper, /Switch workspace/i);
  assert.match(helper, /isLoginShellVisible/);
  assert.match(helper, /Authenticated session was not restored after direct navigation/);
  assert.doesNotMatch(helper, /toContainText\(\/86 chaos\|today\|manager brief/i);
});

test('authenticated release routes use deterministic app readiness instead of networkidle', () => {
  const spec = read('tests/e2e/authenticated-release.spec.cjs');
  assert.match(spec, /gotoAuthenticatedRoute/);
  assert.doesNotMatch(spec, /waitForLoadState\(['"]networkidle/);
  assert.doesNotMatch(spec, /86 chaos\|today\|manager brief\|kitchen command\|schedule/i);
});

test('cost regression uses shared authenticated readiness before route assertions', () => {
  const spec = read('tests/e2e/cost-regression.spec.cjs');
  assert.match(spec, /loginIfNeeded/);
  assert.match(spec, /gotoAuthenticatedRoute/);
  assert.match(spec, /assertAuthenticatedAfterNavigation/);
  assert.doesNotMatch(spec, /waitForLoadState\(['"]networkidle/);
});

test('chunk recovery targets a lazy JavaScript chunk and not CSS or main bundle assets', () => {
  const spec = read('tests/e2e/chunk-recovery.spec.cjs');
  assert.match(spec, /\.chunk\\\.js/);
  assert.match(spec, /not\.toMatch\(\/\\\/static\\\/css/);
  assert.match(spec, /reportAttempts, 'one crash report was submitted'\)\.toBe\(1\)/);
  assert.doesNotMatch(spec, /static\\\/\(\?:js\|css\)/);
});

test('login tap-target test waits for stable final styling before scanning buttons', () => {
  const spec = read('tests/e2e/compact-ui-layout.spec.cjs');
  assert.match(spec, /expect\.poll/);
  assert.match(spec, /rect\.height >= 42/);
  assert.match(spec, /final CSS\/layout has settled/);
});

test('desktop Schedule Builder time chips keep compact visuals but enforce a 24px fine-pointer target', () => {
  const css = read('src/styles.css');
  assert.match(css, /16\.0\.152: Desktop\/fine-pointer Schedule Builder time chips/);
  assert.match(css, /button\.schedule-builder-time-chip/);
  assert.match(css, /min-height:\s*24px !important/);
  assert.match(css, /min-width:\s*24px !important/);
});
