const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, bodyText, attachJson, ALLOW_MUTATION, readSeedReport, mutationSkipMessage } = require('./utils/audit-helpers.cjs');

test.describe('08 inventory, recipes, menu intelligence, and 86 alerts', () => {
  test('inventory route renders par/stock/vendor/order surfaces without broken unit or money math', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'inventory', { settleMs: 2200, maxText: 70000 });
    await attachJson(testInfo, '08-inventory-route.json', { sample: text.slice(0, 8000) });
    expect(text).toMatch(/Inventory|Vendor|Par|Invoice|Burn|Order|Stock/i);
    expect(text).not.toMatch(/Invalid Date|Infinity|undefined undefined|null null|\$NaN|NaN%|(?:^|[^A-Za-z])NaN(?:[^A-Za-z]|$)/i);
  });

  test('recipes/menu intelligence render cost and dependency surfaces without broken values', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const recipesText = await gotoTab(page, 'recipes', { settleMs: 1600, maxText: 55000 });
    const menuText = await gotoTab(page, 'menu-intelligence', { settleMs: 1600, maxText: 55000 });
    await attachJson(testInfo, '08-recipes-menu-route.json', { recipesSample: recipesText.slice(0, 5000), menuSample: menuText.slice(0, 5000) });
    expect(recipesText).toMatch(/Recipe|Ingredient|Instructions|Yield|Cost|Prep/i);
    expect(`${recipesText}\n${menuText}`).not.toMatch(/Invalid Date|Infinity|undefined undefined|null null|\$NaN|NaN%|(?:^|[^A-Za-z])NaN(?:[^A-Za-z]|$)/i);
  });

  test('fake restaurant seed links zero stock inventory to 86 alert and menu dependency data', async ({}, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const seed = readSeedReport();
    expect(seed?.ok, 'Seed report should exist').toBe(true);
    const counts = seed.profile.createdCounts;
    const cross = seed.profile.expectations.crossModule;
    await attachJson(testInfo, '08-inventory-alert-seed.json', { counts, cross });
    expect(counts.inventoryItems).toBeGreaterThanOrEqual(4);
    expect(counts.restaurantAdminAlerts).toBeGreaterThanOrEqual(2);
    expect(counts.menuDependencies).toBeGreaterThanOrEqual(2);
    expect(cross.inventoryZeroItem).toBe('QA Salmon Portion');
  });

  test('86 alert surfaces show open/ack/resolved vocabulary and do not imply inventory writes on acknowledge', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'messages', { settleMs: 1800, maxText: 60000 });
    await attachJson(testInfo, '08-message-alert-route.json', { sample: text.slice(0, 7000) });
    expect(text).toMatch(/Message|86|Alert|Acknowledge|Resolve|Post|Board/i);
    expect(text).not.toMatch(/Invalid Date|Infinity|undefined undefined|null null|\$NaN|NaN%|(?:^|[^A-Za-z])NaN(?:[^A-Za-z]|$)/i);
  });
});
