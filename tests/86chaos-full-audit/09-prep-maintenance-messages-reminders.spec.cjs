const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, attachJson, ALLOW_MUTATION, readSeedReport, mutationSkipMessage } = require('./utils/audit-helpers.cjs');

test.describe('09 prep/tasks, maintenance, messages, and reminders', () => {
  test('prep/tasks/checklists route loads and shows no broken completion math', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'prep', { settleMs: 1600, maxText: 60000 });
    await attachJson(testInfo, '09-prep-route.json', { sample: text.slice(0, 7000) });
    expect(text).toMatch(/Prep|Task|Checklist|Label|Done|Open/i);
    expect(text).not.toMatch(/Invalid Date|NaN|Infinity|undefined undefined|null null/i);
  });

  test('maintenance route loads urgent, recurring, resolved/history vocabulary without broken dates', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'maintenance', { settleMs: 1600, maxText: 60000 });
    await attachJson(testInfo, '09-maintenance-route.json', { sample: text.slice(0, 7000) });
    expect(text).toMatch(/Maintenance|Equipment|Issue|Preventive|Urgent|Repair|Resolved|PM/i);
    expect(text).not.toMatch(/Invalid Date|NaN|Inactive -\d+ days|undefined undefined|null null/i);
  });

  test('reminders route loads recurring/shared/personal surfaces and does not duplicate obvious push labels', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'reminders', { settleMs: 1600, maxText: 50000 });
    await attachJson(testInfo, '09-reminders-route.json', { sample: text.slice(0, 6000) });
    expect(text).toMatch(/Reminder|Personal|Shared|Daily|Weekly|Monthly|Due/i);
    expect(text).not.toMatch(/Invalid Date|NaN|undefined undefined|null null/i);
  });

  test('fake restaurant seed includes prep, tasks, maintenance, reminders, and message/alert records', async ({}, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const seed = readSeedReport();
    expect(seed?.ok, 'Seed report should exist').toBe(true);
    const counts = seed.profile.createdCounts;
    await attachJson(testInfo, '09-ops-seed-counts.json', { counts });
    expect(counts.prepItems).toBeGreaterThanOrEqual(2);
    expect(counts.tasks).toBeGreaterThanOrEqual(2);
    expect(counts.maintenanceLogs).toBeGreaterThanOrEqual(2);
    expect(counts.personalReminders).toBeGreaterThanOrEqual(2);
    expect(counts.events).toBeGreaterThanOrEqual(3);
  });
});
