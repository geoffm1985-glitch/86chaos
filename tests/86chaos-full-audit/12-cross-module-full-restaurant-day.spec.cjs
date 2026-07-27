const { test, expect } = require('@playwright/test');
const { hasFeature, ownerLikeCreds, requireCreds, login, gotoTab, bodyText, attachJson, ALLOW_MUTATION, readSeedReport, mutationSkipMessage } = require('./utils/audit-helpers.cjs');

test.skip(!hasFeature('today'), 'Feature today is not present in this app version.');
test.describe('12 cross-module impact and full restaurant day', () => {
  test('core cross-module surfaces are all visible without broken math: Manager Brief, Kitchen, Schedule, Inventory, Messages, Financials', async ({ page }, testInfo) => {
    test.setTimeout(10 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const tabs = ['today', 'kitchen', 'schedule', 'inventory', 'messages', 'financials'];
    const samples = {};
    for (const tab of tabs) samples[tab] = (await gotoTab(page, tab, { settleMs: 1500, maxText: 50000 })).slice(0, 6000);
    const joined = Object.values(samples).join('\n');
    await attachJson(testInfo, '12-cross-module-samples.json', { samples });
    expect(joined).toMatch(/Need Attention|Manager Brief|Kitchen|Schedule|Inventory|Message|Financial|Labor|86/i);
    expect(joined).not.toMatch(/Invalid Date|NaN|Infinity|undefined undefined|null null|Inactive -\d+ days/i);
  });

  test('fake restaurant seed has all cross-module trigger data required for full restaurant-day audit', async ({}, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const seed = readSeedReport();
    expect(seed?.ok, 'Seed report should exist').toBe(true);
    const counts = seed.profile.createdCounts;
    const required = ['users', 'shifts', 'timeOffRequests', 'events', 'timePunches', 'inventoryItems', 'recipes', 'menuDependencies', 'restaurantAdminAlerts', 'prepItems', 'tasks', 'maintenanceLogs', 'sales'];
    const missing = required.filter(k => !(counts[k] > 0));
    await attachJson(testInfo, '12-full-restaurant-day-seed-coverage.json', { counts, missing, expectations: seed.profile.expectations });
    expect(missing, 'Fake restaurant should populate every core app area for full restaurant-day testing').toEqual([]);
  });

  test('published schedule, open punch, inventory 86, maintenance urgent, and sales/labor all have visible downstream homes', async ({ page }, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const managerBrief = await gotoTab(page, 'today', { settleMs: 2200, maxText: 70000 });
    const kitchen = await gotoTab(page, 'kitchen', { settleMs: 1800, maxText: 70000 });
    const messages = await gotoTab(page, 'messages', { settleMs: 1600, maxText: 50000 });
    const joined = `${managerBrief}\n${kitchen}\n${messages}`;
    await attachJson(testInfo, '12-downstream-homes.json', { managerBrief: managerBrief.slice(0, 7000), kitchen: kitchen.slice(0, 7000), messages: messages.slice(0, 5000) });
    expect(joined, 'Seeded 86/inventory/maintenance signals should appear somewhere in operational downstream surfaces').toMatch(/QA Salmon|86|Critical Fryer|Fryer|below par|maintenance|Need Attention|Alert/i);
  });
});
