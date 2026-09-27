const { test, expect } = require('@playwright/test');
const pkg = require('../../package.json');

test.describe('45 Firebase Admin WHATWG URL modernization', () => {
  test('deployed 17.0.36 server routes initialize without Firebase Admin legacy-namespace failures', async ({ request }) => {
    const versionResponse = await request.get('/version.json?firebaseAdminUrlApi=1');
    expect(versionResponse.ok()).toBeTruthy();
    const version = await versionResponse.json();
    expect(version.version).toBe(pkg.version);

    for (const route of ['/api/whoami', '/api/admin-access']) {
      const response = await request.get(route);
      expect(response.status(), `${route} must fail closed for an unauthenticated probe, not crash the Admin SDK`).not.toBe(500);
      expect([200, 400, 401, 403, 405]).toContain(response.status());
    }
  });
});
