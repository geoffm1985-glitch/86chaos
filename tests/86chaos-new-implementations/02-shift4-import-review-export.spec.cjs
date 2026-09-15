const { test, expect } = require('@playwright/test');
const { creds, requireCreds, login, gotoTab } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

async function downloadBytes(download) {
  const stream = await download.createReadStream(); const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test('manual location, import review, and safe exports remain review-only', async ({ page }) => {
  const account = creds('SYSTEM_ADMIN'); requireCreds(account, 'System Administrator');
  await page.route('**/api/shift4-status**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, configured: true, state: 'connected', selectedLocation: null, suggestedYesterday: '2026-09-13' }) }));
  await page.route('**/api/shift4-locations**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, locations: [{ id: '17', name: 'Fixture Dine', timeZone: 'America/Chicago', supportStatus: 'supported', supportReason: 'Fixture verified.' }, { id: '18', name: 'Legacy Unknown', supportStatus: 'unverified', supportReason: 'Not verified.' }] }) }));
  await page.route('**/api/shift4-select-location', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, selectedLocation: { id: '17', name: 'Fixture Dine', supportStatus: 'supported' } }) }));
  await page.route('**/api/shift4-sync', route => route.fulfill({ status: 206, contentType: 'application/json', body: JSON.stringify({ ok: true, summary: { status: 'api_contract_unverified', partial: true, rawSourceRowsReceived: 1, uniqueTicketsRetained: 1, normalizedRecords: 2, inserted: 2, updated: 0, unchanged: 0, normalizationRejected: 0 }, preview: { isPreview: true, limit: 100, records: [{ idempotencyKey: 'ticket', businessDate: '2026-09-13', recordType: 'ticket', orderNumber: '86', netAmountCents: 1500 }, { idempotencyKey: 'item', businessDate: '2026-09-13', recordType: 'ticketItem', menuItemName: 'Crème brûlée, special', quantity: 1, netAmountCents: 1200 }] } }) }));
  await page.route('**/api/shift4-export**', route => route.fulfill({ status: 200, headers: { 'content-type': route.request().url().includes('format=csv') ? 'text/csv' : 'application/json', 'content-disposition': 'attachment; filename="fixture"' }, body: route.request().url().includes('format=csv') ? 'schemaVersion,provider,menuItemName,netAmountCents\n3,shift4,"Crème brûlée, special",-1200' : JSON.stringify({ schemaVersion: 3, provider: 'shift4', completeness: { complete: false, reason: 'api_contract_unverified' }, records: [] }) }));
  await login(page, account.email, account.password, { chooseWorkspace: true }); await gotoTab(page, 'settings');
  await page.getByRole('button', { name: /integrations/i }).first().click(); await page.getByLabel('POS Provider').selectOption('shift4');
  await page.getByRole('button', { name: /load locations/i }).click();
  await expect(page.getByLabel('Shift4 location')).toBeVisible();
  await page.getByLabel('Shift4 location').selectOption('17'); await page.getByRole('button', { name: /save location/i }).click();
  await page.getByRole('button', { name: /^import from shift4$/i }).click();
  await expect(page.getByTestId('shift4-import-summary')).toContainText(/api_contract_unverified.*1 raw tickets.*1 unique tickets.*2 review rows/i);
  await expect(page.getByText('Crème brûlée, special')).toBeVisible(); await expect(page.getByText('Draft only').first()).toBeVisible();
  const csvEvent = page.waitForEvent('download'); await page.getByRole('button', { name: /export csv/i }).click();
  const csv = (await downloadBytes(await csvEvent)).toString('utf8'); expect(csv).toContain('schemaVersion,provider'); expect(csv).toContain('Crème brûlée, special'); expect(csv).not.toMatch(/access_token|4111111111111111/i);
  const jsonEvent = page.waitForEvent('download'); await page.getByRole('button', { name: /export json/i }).click();
  const json = JSON.parse((await downloadBytes(await jsonEvent)).toString('utf8')); expect(json.schemaVersion).toBe(3); expect(json.completeness.complete).toBe(false); expect(JSON.stringify(json)).not.toMatch(/access_token|4111111111111111/i);
});
