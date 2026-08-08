const { expect } = require('@playwright/test');

function emailLoginField(page) {
  return page.getByRole('textbox', { name: /^Email Address$/i })
    .or(page.locator('input[type="email"], input[autocomplete="email"], input[aria-label="Email Address"]'))
    .first();
}

function passwordLoginField(page) {
  return page.locator('input[type="password"][autocomplete="current-password"], input[type="password"][aria-label="Password"]').first();
}

function unlockLoginButton(page) {
  return page.getByRole('button', { name: /^Unlock System$/i })
    .or(page.getByRole('button', { name: /^(Log In|Sign In)$/i }))
    .first();
}

function authenticatedShellLocator(page) {
  return page.getByRole('button', { name: /switch workspace\. active workspace/i })
    .or(page.getByLabel(/switch workspace/i))
    .or(page.locator('[aria-label*="Switch workspace" i], [data-testid*="workspace-switch" i], [data-testid*="workspace-switcher" i]'))
    .first();
}

function workspaceChooserLocator(page) {
  return page.getByText(/choose workspace/i).first();
}

async function isLoginShellVisible(page) {
  const [emailVisible, passwordVisible, unlockVisible] = await Promise.all([
    emailLoginField(page).isVisible({ timeout: 600 }).catch(() => false),
    passwordLoginField(page).isVisible({ timeout: 600 }).catch(() => false),
    unlockLoginButton(page).isVisible({ timeout: 600 }).catch(() => false)
  ]);
  return emailVisible || passwordVisible || unlockVisible;
}

async function fillReleaseLogin(page, email, password) {
  const emailInput = emailLoginField(page);
  await expect(emailInput, 'Email Address login field must resolve exactly and be visible').toBeVisible({ timeout: 10000 });
  await emailInput.fill(email);
  const passwordInput = passwordLoginField(page);
  await expect(passwordInput, 'Password login field must be the actual password input, not Forgot Password').toBeVisible({ timeout: 10000 });
  await passwordInput.fill(password);
  const unlock = unlockLoginButton(page);
  await expect(unlock, 'Unlock System login button should be visible').toBeVisible({ timeout: 10000 });
  await unlock.click();
}

async function chooseReleaseWorkspaceIfNeeded(page, options = {}) {
  const chooser = workspaceChooserLocator(page);
  if (!(await chooser.isVisible({ timeout: options.chooserTimeout || 5000 }).catch(() => false))) return false;
  const requested = options.workspaceName || process.env.CHAOS_QA_WORKSPACE_NAME || process.env.CHAOS_QA_WORKSPACE || '';
  if (process.env.CHAOS_RELEASE_GATE === 'true' && !requested) {
    throw new Error('CHAOS_QA_WORKSPACE_NAME is required when a workspace chooser appears.');
  }
  const target = requested
    ? page.getByText(requested, { exact: false }).first()
    : page.locator('button, [role="button"]').filter({ hasText: /owner|manager|staff|admin/i }).first();
  await expect(target, `Workspace chooser should show ${requested || 'an available workspace'}`).toBeVisible({ timeout: 10_000 });
  await target.click();
  await expect(chooser, 'Workspace chooser should close after selecting the release workspace').toBeHidden({ timeout: 15_000 }).catch(() => {});
  return true;
}

async function waitForAuthenticatedShell(page, options = {}) {
  const timeout = Number(options.timeout || 30_000);
  if (options.chooseWorkspace !== false) await chooseReleaseWorkspaceIfNeeded(page, options);
  await expect.poll(async () => {
    if (await isLoginShellVisible(page)) return 'login-shell';
    if (await workspaceChooserLocator(page).isVisible({ timeout: 300 }).catch(() => false)) return 'workspace-chooser';
    if (await authenticatedShellLocator(page).isVisible({ timeout: 500 }).catch(() => false)) return 'authenticated-shell';
    return 'pending';
  }, {
    timeout,
    intervals: [150, 250, 500, 750],
    message: options.message || 'Authenticated app shell should be ready without accepting the login logo as proof'
  }).toBe('authenticated-shell');

  if (await isLoginShellVisible(page)) {
    throw new Error(options.persistenceCheck
      ? 'Authenticated session was not restored after direct navigation'
      : 'Login shell remained visible after authenticated readiness was claimed');
  }
}

async function loginIfNeeded(page, email, password, options = {}) {
  if (await isLoginShellVisible(page)) {
    await fillReleaseLogin(page, email, password);
    await waitForAuthenticatedShell(page, options);
    return true;
  }
  await waitForAuthenticatedShell(page, { ...options, timeout: options.timeout || 20_000 });
  return false;
}

async function assertAuthenticatedAfterNavigation(page, options = {}) {
  if (await isLoginShellVisible(page)) throw new Error('Authenticated session was not restored after direct navigation');
  await waitForAuthenticatedShell(page, { ...options, persistenceCheck: true });
}

async function gotoAuthenticatedRoute(page, tab, options = {}) {
  await page.goto(`/?tab=${encodeURIComponent(tab)}`, { waitUntil: 'domcontentloaded' });
  await assertAuthenticatedAfterNavigation(page, options);
}

module.exports = {
  fillReleaseLogin,
  loginIfNeeded,
  isLoginShellVisible,
  chooseReleaseWorkspaceIfNeeded,
  waitForAuthenticatedShell,
  assertAuthenticatedAfterNavigation,
  gotoAuthenticatedRoute,
  authenticatedShellLocator
};
