const { test, expect } = require('@playwright/test');

test.describe('45 Firebase Admin WHATWG URL modernization', () => {
  test('deployed 17.0.36 server routes initialize without Firebase Admin legacy-namespace failures', async ({ request }) => {
    const versionResponse = await request.get('/version.json?firebaseAdminUrlApi=1');
    expect(versionResponse.ok()).toBeTruthy();
    const version = await versionResponse.json();
    expect(version.version).toBe('17.0.36');

    for (const route of ['/api/whoami', '/api/admin-access']) {
      const response = await request.get(route);
      expect(response.status(), `${route} must fail closed for an unauthenticated probe, not crash the Admin SDK`).not.toBe(500);
      expect([200, 400, 401, 403, 405]).toContain(response.status());
    }
  });
});
