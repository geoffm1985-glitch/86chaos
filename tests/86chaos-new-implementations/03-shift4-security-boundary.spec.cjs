const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('every Shift4 tenant API rejects forged unauthenticated workspace requests without secret leakage', async ({ request }) => {
  const cases = [
    ['POST','/api/shift4-connect'], ['GET','/api/shift4-status'], ['GET','/api/shift4-locations'], ['POST','/api/shift4-select-location'], ['POST','/api/shift4-test'], ['POST','/api/shift4-sync'], ['GET','/api/shift4-records'], ['GET','/api/shift4-export']
  ];
  for (const [method, endpoint] of cases) {
    const options = { method, failOnStatusCode: false };
    if (method === 'POST') options.data = { restaurantId: 'forged-restaurant-b', from: '2026-09-13', to: '2026-09-13', locationId: '999' };
    const response = await request.fetch(`${endpoint}?restaurantId=forged-restaurant-b`, options);
    expect(response.status(), endpoint).toBeGreaterThanOrEqual(400); expect(response.status(), endpoint).toBeLessThan(500);
    const text = await response.text(); expect(text).not.toMatch(/access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|ciphertext|authTag|SHIFT4_TOKEN/i);
  }
});

test('server-only implementation has no operational auto-apply or client secret path', async () => {
  const root = process.cwd();
  const client = fs.readFileSync(path.join(root, 'src/components/Shift4IntegrationPanel.jsx'), 'utf8');
  const sync = fs.readFileSync(path.join(root, 'api/shift4-sync.js'), 'utf8');
  const storage = fs.readFileSync(path.join(root, 'api/_shift4-storage.js'), 'utf8');
  expect(client).not.toMatch(/SHIFT4_CLIENT_SECRET|SHIFT4_TOKEN_ENCRYPTION_KEY|refreshToken|accessToken/);
  expect(sync).not.toMatch(/collection\(['"](?:inventory|sales|shifts|timePunches|payroll|vendorOrders|ledger|dailyClose)/);
  expect(storage).toMatch(/posSyncScopes/); expect(storage).toMatch(/shift4Credentials/);
});
