'use strict';

async function waitForAuditAuthSurface(page, { timeout = 20000 } = {}) {
  // A version footer or an empty React shell is not an authenticated session.
  // Both the login and workspace chooser use the authored login-screen wrapper;
  // an authenticated workspace exposes the authored workspace switch control.
  await page.locator('.chaos-login-screen,button[aria-label^="Switch workspace"]').first().waitFor({ state: 'visible', timeout });
}

module.exports = { waitForAuditAuthSurface };
