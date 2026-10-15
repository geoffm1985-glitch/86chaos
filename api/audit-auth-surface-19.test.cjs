'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, webkit } = require('@playwright/test');
const { waitForAuditAuthSurface } = require('../tests/fixtures/audit-auth-surface.cjs');

for (const [name, engine] of Object.entries({ chromium, webkit })) {
  test(`${name}: an unhydrated shell cannot bypass login readiness`, async t => {
    const browser = await engine.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.setContent('<body>VERSION 19.x</body>');
    const waiting = waitForAuditAuthSurface(page);
    await page.evaluate(() => setTimeout(() => { document.body.innerHTML = '<main class="chaos-login-screen"><label>Email Address<input type="email"></label><button>Unlock System</button></main>'; }, 100));
    await waiting;
    assert.equal(await page.getByRole('button', { name: 'Unlock System' }).isVisible(), true);
    assert.equal(await page.getByRole('textbox', { name: 'Email Address' }).isVisible(), true);

    await page.setContent('<button aria-label="Switch workspace. Active workspace QA.">QA workspace</button>');
    await waitForAuditAuthSurface(page);
    assert.equal(await page.getByRole('button', { name: /Switch workspace/ }).isVisible(), true);

    await page.setContent('<body>Loading workspace… VERSION 19.x</body>');
    await assert.rejects(waitForAuditAuthSurface(page, { timeout: 100 }), /Timeout/);
  });
}
