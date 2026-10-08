'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { creds, requireCreds, login, gotoTab, attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { getFirebaseTarget } = require('../../scripts/86chaos-firebase-target.cjs');
const root = path.resolve(__dirname, '../..');

test.describe('17.0.64 emulator runtime-boundary cascade repair', () => {
  test('selected emulator project, storage readiness path, and compact Schedule CSS stay fail-closed', async () => {
    const requestOff = fs.readFileSync(path.join(root, 'tests/e2e/schedule-request-off-management.spec.cjs'), 'utf8');
    const firebaseTarget = fs.readFileSync(path.join(root, 'src/core/firebaseTarget.js'), 'utf8');
    const appCore = fs.readFileSync(path.join(root, 'src/core/appCore.js'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
    expect(requestOff).toMatch(/expectedFirebaseProject\(process\.env\)/);
    expect(requestOff).not.toMatch(/const QA_TEST_PROJECT_ID = ['"]chaos-test-d1601['"]/);
    expect(firebaseTarget).toMatch(/probe\('Storage',[\s\S]*\/v0\/b\//);
    expect(appCore.indexOf('if (isFirebaseEmulatorTarget)')).toBeLessThan(appCore.indexOf('enableMultiTabIndexedDbPersistence(db)'));
    const mobile = css.match(/@media \(max-width: 767px\) \{[\s\S]*?\.schedule-builder-control-deck \{([\s\S]*?)\s*\}/);
    expect(mobile?.[1] || '').toMatch(/position: relative !important/);
  });

  test('System Administrator emulator route has no Firestore internal assertion, Storage-root 501, or CRA runtime overlay', async ({ page }, testInfo) => {
    const target = getFirebaseTarget(process.env);
    test.skip(!target.emulator, 'This runtime regression is specific to the Yardmaster Firebase emulator target.');
    const account = creds('SYSTEM_ADMIN');
    requireCreds(account, 'SYSTEM_ADMIN');
    const pageErrors = [];
    const badStorageResponses = [];
    page.on('pageerror', error => pageErrors.push(String(error?.stack || error?.message || error)));
    page.on('response', response => {
      try {
        const url = new URL(response.url());
        if (url.hostname === target.host && Number(url.port) === target.ports.storage && url.pathname === '/' && response.status() >= 500) {
          badStorageResponses.push({ url: response.url(), status: response.status() });
        }
      } catch (_) {}
    });

    await login(page, account.email, account.password);
    await page.waitForFunction(async () => {
      try {
        const pending = window.__CHAOS_FIREBASE_EMULATOR_READY__;
        if (!pending) return false;
        const state = await pending;
        return state?.ok === true && state?.target === 'EMULATOR';
      } catch (_) { return false; }
    }, null, { timeout: 15000 });
    const text = await gotoTab(page, 'godmode', { settleMs: 2500, maxText: 70000 });
    const people = page.getByRole('button', { name: /Open People|People Directory/i }).first();
    if (await people.isVisible().catch(() => false)) {
      await people.click();
      await page.waitForTimeout(900);
    }
    const overlays = await page.locator('iframe#webpack-dev-server-client-overlay').count();
    const firestoreAssertions = pageErrors.filter(value => /FIRESTORE.*INTERNAL ASSERTION FAILED|INTERNAL ASSERTION FAILED.*Unexpected state/i.test(value));
    await attachJson(testInfo, '76-emulator-runtime-boundaries-17-0-64.json', {
      target: { target: target.target, projectId: target.projectId, host: target.host, storagePort: target.ports.storage },
      badStorageResponses,
      firestoreAssertions,
      overlays,
      textSample: text.slice(0, 8000),
    });
    expect(text).not.toMatch(/86 CHAOS APP RECOVERY|This section hit a snag/i);
    expect(badStorageResponses).toEqual([]);
    expect(firestoreAssertions).toEqual([]);
    expect(overlays).toBe(0);
  });
});
