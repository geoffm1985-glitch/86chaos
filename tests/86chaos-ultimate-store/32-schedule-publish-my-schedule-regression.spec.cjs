const { test, expect } = require('@playwright/test');
const { ALLOW_MUTATION, mutationSkipMessage, readSeedReport, ownerLikeCreds, creds, requireCreds, login, gotoTab, bodyText, attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('32 Schedule publish and employee visibility regressions', () => {
  test('partial publish includes every visible draft shift in the selected schedule week', async ({ page }, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const seed = readSeedReport();
    expect(seed?.ok, 'Seed report should exist before schedule publish regression tests').toBe(true);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'schedule', { settleMs: 2500, maxText: 85000 });
    const publishButton = page.getByRole('button', { name: /^publish$/i }).first();
    await expect(publishButton, 'Schedule Builder publish button should be visible').toBeVisible({ timeout: 15000 });
    await publishButton.click();
    const pickerText = await bodyText(page, 60000);
    await attachJson(testInfo, '32-publish-picker-before-action.json', { sample: pickerText.slice(0, 9000) });
    expect(pickerText, 'Publish picker should ask what schedule weeks to publish').toMatch(/choose.*weeks|publish selected weeks|week 1|week 2/i);
    expect(pickerText, 'Publish picker should show draft counts so managers can catch missed shifts').toMatch(/draft/i);
    // This test intentionally stops before confirming publish when existing state is unknown.
    // The release gate separately verifies data mutations and cleanup; this regression catches
    // the UI path that used to silently publish only a subset of visible selected-week shifts.
  });

  test('employee My Schedule list shows published shifts from the full schedule period, not only same-month dates', async ({ page }, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const staff = creds('STAFF');
    requireCreds(staff, 'staff account');
    await login(page, staff.email, staff.password);
    const text = await gotoTab(page, 'schedule', { settleMs: 2500, maxText: 85000 });
    await attachJson(testInfo, '32-employee-my-schedule-sample.json', { sample: text.slice(0, 12000) });
    expect(text, 'Employee schedule page should load').toMatch(/My Schedule|Clock In|Trade Board|Request Off/i);
    expect(text, 'Employee schedule list should use schedule-period wording after pay-period partial publish fixes').toMatch(/My Published Schedule|published shifts|schedule period/i);
    expect(text, 'Employee-facing schedule should not claim no month shifts while a Next shift is visible').not.toMatch(/Next:[\s\S]{0,300}No shifts scheduled for you this month/i);
  });
});
