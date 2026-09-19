const { expect } = require('@playwright/test');

const TRANSIENT_FIREBASE_AUTH_ERROR_RE = /auth\/(?:the-service-is-currently-unavailable|network-request-failed|internal-error)\b/i;

function loginShellLocator(page) {
  return page.locator('.chaos-login-screen').first();
}

function emailLoginField(page) {
  const shell = loginShellLocator(page);
  return shell.getByRole('textbox', { name: /^Email Address$/i })
    .or(shell.locator('input[type="email"], input[autocomplete="email"], input[aria-label="Email Address"]'))
    .first();
}

function passwordLoginField(page) {
  const shell = loginShellLocator(page);
  return shell.locator('input[type="password"][autocomplete="current-password"], input[type="password"][aria-label="Password"]').first();
}

function unlockLoginButton(page) {
  const shell = loginShellLocator(page);
  return shell.getByRole('button', { name: /^Unlock System$/i })
    .or(shell.getByRole('button', { name: /^(Log In|Sign In)$/i }))
    .first();
}


function escapeRegex(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizedTextRegex(value = '') {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean).map(escapeRegex);
  return new RegExp(`^\\s*${parts.join('\\s+')}\\s*$`, 'i');
}

function workspaceOpenButtonRegex(value = '') {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean).map(escapeRegex);
  return new RegExp(`^\\s*Open\\s+${parts.join('\\s+')}`, 'i');
}


function releaseWorkspaceName(options = {}) {
  return String(options.workspaceName || process.env.CHAOS_QA_WORKSPACE_NAME || process.env.CHAOS_QA_WORKSPACE || '').trim();
}

function authenticatedShellLocator(page) {
  return page.getByRole('button', { name: /switch workspace\. active workspace/i })
    .or(page.getByLabel(/switch workspace/i))
    .or(page.locator('[aria-label*="Switch workspace" i], [data-testid*="workspace-switch" i], [data-testid*="workspace-switcher" i]'))
    .first();
}

function workspaceChooserLocator(page) {
  return page.getByRole('heading', { name: /^(Choose|Select) (Workspace|Restaurant)$/i }).first();
}

function workspaceChoiceButton(page, workspaceName) {
  return page.getByRole('button', { name: workspaceOpenButtonRegex(workspaceName) });
}

async function isLoginShellVisible(page) {
  const shell = loginShellLocator(page);
  if (!(await shell.isVisible({ timeout: 600 }).catch(() => false))) return false;
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
  if (!(await chooser.isVisible({ timeout: options.chooserTimeout || 700 }).catch(() => false))) return false;
  const requested = releaseWorkspaceName(options);
  if (process.env.CHAOS_RELEASE_GATE === 'true' && !requested) {
    throw new Error('CHAOS_QA_WORKSPACE_NAME is required when a workspace chooser appears.');
  }
  if (!requested) {
    throw new Error('Workspace chooser appeared but no workspaceName or CHAOS_QA_WORKSPACE_NAME was configured.');
  }
  await expect(chooser, 'Choose Workspace heading should be visible before selecting a release workspace').toBeVisible({ timeout: 10_000 });
  const target = workspaceChoiceButton(page, requested);
  const targetCount = await target.count();
  if (targetCount !== 1) {
    throw new Error(`Workspace chooser must expose exactly one button for ${requested}; found ${targetCount}.`);
  }
  const targetButton = target.first();
  await expect(targetButton, `Workspace chooser should show the configured QA workspace button for ${requested}`).toBeVisible({ timeout: 10_000 });
  await targetButton.click();
  await expect(chooser, 'Workspace chooser should close after selecting the configured release workspace').toBeHidden({ timeout: 15_000 }).catch(() => {});
  return true;
}

async function waitForAuthenticatedShell(page, options = {}) {
  const timeout = Number(options.timeout || 30_000);
  const deadline = Date.now() + timeout;
  let lastState = 'pending';
  let selectedWorkspace = false;
  while (Date.now() < deadline) {
    if (await authenticatedShellLocator(page).isVisible({ timeout: 450 }).catch(() => false)) {
      if (await isLoginShellVisible(page)) {
        throw new Error(options.persistenceCheck
          ? 'Authenticated session was not restored after direct navigation'
          : 'Login shell remained visible after authenticated readiness was claimed');
      }
      return { state: 'authenticated-shell', selectedWorkspace };
    }

    if (options.chooseWorkspace !== false && await workspaceChooserLocator(page).isVisible({ timeout: 450 }).catch(() => false)) {
      lastState = 'workspace-chooser';
      selectedWorkspace = await chooseReleaseWorkspaceIfNeeded(page, { ...options, chooserTimeout: 450 }) || selectedWorkspace;
      await page.waitForTimeout(250);
      continue;
    }

    if (await isLoginShellVisible(page)) {
      lastState = 'login-shell';
      const loginText = await loginShellLocator(page).innerText({ timeout: 500 }).catch(() => '');
      const transientAuthError = loginText.match(TRANSIENT_FIREBASE_AUTH_ERROR_RE)?.[0] || '';
      if (transientAuthError) {
        throw new Error(`Transient Firebase Auth failure while waiting for authenticated readiness: ${transientAuthError}`);
      }
      await page.waitForTimeout(250);
      continue;
    }

    lastState = 'pending';
    await page.waitForTimeout(250);
  }

  if (lastState === 'login-shell') {
    throw new Error(options.persistenceCheck
      ? 'Authenticated session was not restored after direct navigation'
      : 'Login shell remained visible while waiting for authenticated readiness');
  }
  if (lastState === 'workspace-chooser') {
    throw new Error('Workspace chooser remained visible while waiting for authenticated readiness.');
  }
  throw new Error(options.message || 'Authenticated app shell should be ready without accepting the login logo as proof');
}

async function recoverPendingAuthentication(page, email, password, options = {}) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  const stateDeadline = Date.now() + 5_000;
  while (Date.now() < stateDeadline) {
    if (await isLoginShellVisible(page)) {
      await fillReleaseLogin(page, email, password);
      break;
    }
    const authenticated = await authenticatedShellLocator(page).isVisible({ timeout: 250 }).catch(() => false);
    const chooser = await workspaceChooserLocator(page).isVisible({ timeout: 250 }).catch(() => false);
    if (authenticated || chooser) break;
    await page.waitForTimeout(200);
  }
  await waitForAuthenticatedShell(page, { ...options, timeout: Number(options.recoveryTimeout || 20_000) });
}

async function loginIfNeeded(page, email, password, options = {}) {
  const submitted = await isLoginShellVisible(page);
  try {
    if (submitted) await fillReleaseLogin(page, email, password);
    await waitForAuthenticatedShell(page, { ...options, timeout: options.timeout || (submitted ? 30_000 : 20_000) });
    return submitted;
  } catch (error) {
    const message = String(error?.message || error);
    const pendingShell = /Authenticated app shell should be ready without accepting the login logo as proof/.test(message);
    const transientAuthFailure = TRANSIENT_FIREBASE_AUTH_ERROR_RE.test(message);
    if ((!pendingShell && !transientAuthFailure) || options.retryPendingHydration === false) throw error;
    // One fresh-route retry covers a pending mobile hydration gap or an explicit
    // transient Firebase Auth service failure; all other login errors remain final.
    await recoverPendingAuthentication(page, email, password, options);
    return true;
  }
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
  authenticatedShellLocator,
  loginShellLocator
};
