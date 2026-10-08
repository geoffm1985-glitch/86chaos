const { test, expect } = require('@playwright/test');
const pkg = require('../../package.json');
test.describe('46 Firebase Admin serverless runtime compatibility', () => {
  test('Personal Reminder APIs load their Firebase Admin dependency tree instead of crashing before the handler', async ({ request }) => {
    const versionResponse = await request.get('/version.json?reminderRuntimeRepair=1');
    expect(versionResponse.ok()).toBeTruthy();
    const version = await versionResponse.json();
    expect(version.version).toBe(pkg.version);
    for (const route of ['/api/personal-reminder-list', '/api/personal-reminder-save', '/api/personal-reminder-action']) {
      const response = await request.get(route + '?runtimeModuleLoad=1');
      expect(response.status(), route + ' must reach its method guard instead of crashing during module initialization').toBe(405);
      const body = await response.json();
      expect(String(body.error || '')).toMatch(/Method Not Allowed/i);
    }
  });
});
