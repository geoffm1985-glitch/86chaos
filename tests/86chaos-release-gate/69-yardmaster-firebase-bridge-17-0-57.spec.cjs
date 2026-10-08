const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const bridge = require('../../yardmaster.firebase.json');

test.describe('17.0.57 Yardmaster Firebase bridge', () => {
  test('root bridge is discoverable and names existing complete gate scripts', () => {
    const pkg = require('../../package.json');
    expect(bridge.schema).toBe(1);
    expect(bridge.projectId).toBe('demo-86chaos');
    expect(bridge.products.slice().sort()).toEqual(['auth', 'database', 'firestore', 'functions', 'storage']);
    for (const script of [bridge.localApp.startScript, ...Object.values(bridge.scripts)]) expect(pkg.scripts[script]).toBeTruthy();
    expect(bridge.scripts.full).toBe('test:play-store');
    expect(bridge.scripts.delta).toBe('test:play-store:delta');
    expect(fs.existsSync(path.join(root, bridge.firebaseConfig))).toBe(true);
  });

  test('local Yardmaster observes actual SDK readiness and blocks live Firebase', async ({ page, request, baseURL }) => {
    // This spec belongs to the complete gate; its local runtime case applies to emulator runs.
    test.skip(new URL(baseURL).hostname !== '127.0.0.1' || !/emulator/i.test(process.env.YARDMASTER_FIREBASE_TARGET || process.env.CHAOS_FIREBASE_TARGET || process.env.REACT_APP_86CHAOS_FIREBASE_TARGET || ''), 'Requires the focused local emulator bridge runner.');
    const response = await request.get(bridge.localApp.readyPath);
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ target: 'emulator', projectId: 'demo-86chaos', blockLiveFirebase: true, products: bridge.products });
    const navigation = await page.goto('/');
    expect(navigation.headers()['content-security-policy']).toContain("connect-src 'self'");
    await page.waitForFunction(() => Boolean(window.__CHAOS_FIREBASE_DIAGNOSTICS__));
    const diagnostics = await page.evaluate(async () => { await window.__CHAOS_FIREBASE_EMULATOR_READY__; return window.__CHAOS_FIREBASE_DIAGNOSTICS__; });
    expect(diagnostics.target).toBe('EMULATOR');
    expect(diagnostics.projectId).toBe('demo-86chaos');
    expect(diagnostics.connectedProducts).toEqual(bridge.products);
    await expect(page.getByTestId('firebase-emulator-startup-failure')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toBe('');
    // CSP acts in an ordinary browser context too; no Playwright route mock or network guard.
    const result = await page.evaluate(async () => {
      const violations = [];
      document.addEventListener('securitypolicyviolation', e => violations.push(e.blockedURI));
      for (const url of ['https://firestore.googleapis.com/', 'https://identitytoolkit.googleapis.com/', 'https://cheers-34b8d-default-rtdb.firebaseio.com/']) {
        try { await fetch(url); return { escaped: url }; } catch (_) {}
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      return { violations };
    });
    expect(result.escaped).toBeUndefined();
    expect(result.violations).toHaveLength(3);
  });
});
