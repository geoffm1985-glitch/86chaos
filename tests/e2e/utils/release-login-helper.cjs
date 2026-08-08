const { expect } = require('@playwright/test');

async function fillReleaseLogin(page, email, password) {
  const emailInput = page.getByRole('textbox', { name: /^Email Address$/i }).or(page.locator('input[type="email"], input[autocomplete="email"], input[aria-label="Email Address"]')).first();
  await expect(emailInput, 'Email Address login field must resolve exactly and be visible').toBeVisible({ timeout: 10000 });
  await emailInput.fill(email);
  const passwordInput = page.locator('input[type="password"][autocomplete="current-password"], input[type="password"][aria-label="Password"]').first();
  await expect(passwordInput, 'Password login field must be the actual password input, not Forgot Password').toBeVisible({ timeout: 10000 });
  await passwordInput.fill(password);
  const unlock = page.getByRole('button', { name: /^Unlock System$/i }).or(page.getByRole('button', { name: /^(Log In|Sign In)$/i })).first();
  await expect(unlock, 'Unlock System login button should be visible').toBeVisible({ timeout: 10000 });
  await unlock.click();
}

async function loginIfNeeded(page, email, password) {
  const emailInput = page.getByRole('textbox', { name: /^Email Address$/i }).or(page.locator('input[type="email"], input[autocomplete="email"], input[aria-label="Email Address"]')).first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await fillReleaseLogin(page, email, password);
    return true;
  }
  return false;
}

module.exports = { fillReleaseLogin, loginIfNeeded };
