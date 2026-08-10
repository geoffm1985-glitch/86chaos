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
  assert.match(helper, /authenticatedShellLocator/);
  assert.match(helper, /Switch workspace/i);
  assert.match(helper, /isLoginShellVisible/);
  assert.match(helper, /Authenticated session was not restored after direct navigation/);
  assert.doesNotMatch(helper, /toContainText\(\/86 chaos\|today\|manager brief/i);
});

test('release login helper handles late workspace chooser as an auth-readiness state', () => {
  const helper = read('tests/e2e/utils/release-login-helper.cjs');
  assert.match(helper, /while \(Date\.now\(\) < deadline\)/);
  assert.match(helper, /workspaceChooserLocator\(page\)\.isVisible/);
  assert.match(helper, /chooseReleaseWorkspaceIfNeeded\(page, \{ \.\.\.options, chooserTimeout: 450 \}\)/);
  assert.match(helper, /continue;/);
  assert.match(helper, /Workspace chooser remained visible while waiting for authenticated readiness/);
});

test('release login helper targets the real chooser heading and unique Open workspace button', () => {
  const helper = read('tests/e2e/utils/release-login-helper.cjs');
  assert.match(helper, /CHAOS_QA_WORKSPACE_NAME is required when a workspace chooser appears/);
  assert.match(helper, /getByRole\('heading', \{ name: \/\^\(Choose\|Select\) \(Workspace\|Restaurant\)\$\/i \}\)\.first\(\)/);
  assert.match(helper, /workspaceChoiceButton\(page, requested\)/);
  assert.match(helper, /workspaceOpenButtonRegex\(workspaceName\)/);
  assert.match(helper, /const targetCount = await target\.count\(\)/);
  assert.match(helper, /targetCount !== 1/);
  assert.doesNotMatch(helper, /page\.getByText\(requested/);
  assert.doesNotMatch(helper, /owner\|manager\|staff\|admin/);
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

test('login tap-target CSS repair is scoped to login actions and includes computed diagnostics', () => {
  const spec = read('tests/e2e/compact-ui-layout.spec.cjs');
  const css = read('src/styles.css');
  assert.match(spec, /minHeight/);
  assert.match(spec, /paddingTop/);
  assert.match(spec, /boxSizing/);
  assert.match(spec, /parentTransform/);
  assert.match(css, /16\.0\.154 login action target cascade repair/);
  assert.match(css, /\.chaos-login-screen \.chaos-login-primary-action/);
  assert.match(css, /\.chaos-login-screen \.chaos-login-secondary-action/);
  assert.match(css, /min-height:\s*44px !important/);
});

test('Ghost Request Off uses employee Time Clock and Schedule route without elevating Schedule Builder access', () => {
  const spec = read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs');
  assert.match(spec, /gotoTab\(page, 'published'/);
  assert.ok(spec.includes("getByRole('button', { name: /^Schedule Request Off$/i })"));
  assert.doesNotMatch(spec, /gotoTab\(page, 'schedule', \{ settleMs: 1800, maxText: 70000 \}\)/);
  assert.doesNotMatch(spec, /Allen QA[\s\S]{0,200}Schedule Builder permission/);
});

test('desktop Schedule Builder time chips keep compact visuals but enforce a 24px fine-pointer target', () => {
  const css = read('src/styles.css');
  assert.match(css, /16\.0\.152: Desktop\/fine-pointer Schedule Builder time chips/);
  assert.match(css, /button\.schedule-builder-time-chip/);
  assert.match(css, /min-height:\s*24px !important/);
  assert.match(css, /min-width:\s*24px !important/);
});
