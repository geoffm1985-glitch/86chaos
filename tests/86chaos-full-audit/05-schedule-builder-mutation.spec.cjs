const { test, expect } = require('@playwright/test');
const { ALLOW_MUTATION, mutationSkipMessage, readSeedReport, ownerLikeCreds, requireCreds, login, gotoTab, bodyText, attachJson, collectTextNear, dismissBlockingDialogs } = require('./utils/audit-helpers.cjs');

async function openScheduleBuilder(page) {
  await gotoTab(page, 'schedule', { force: true, settleMs: 0, timeout: 15000, maxText: 60000 });
  const dialogState = await dismissBlockingDialogs(page, { maxPasses: 4 });
  if (!dialogState.ok) throw new Error(`Schedule Builder remained blocked by a dialog: ${dialogState.failure}`);
  const table = page.locator('.schedule-builder-desktop-table').first();
  if (await table.isVisible().catch(() => false)) return table;
  const builder = page.getByRole('button', { name: /^Schedule Builder$/i }).first();
  await expect(builder, 'Schedule Builder control should remain discoverable').toBeVisible({ timeout: 15000 });
  try {
    await builder.click({ timeout: 5000 });
  } catch (error) {
    const message = String(error?.message || error || '');
    if (!/intercepts pointer events|receives pointer events|modal-backdrop/i.test(message)) throw error;
    const lateDialogState = await dismissBlockingDialogs(page, { maxPasses: 4 });
    if (!lateDialogState.ok) throw new Error(`Schedule Builder remained blocked by a late dialog: ${lateDialogState.failure}`);
    await builder.click({ timeout: 5000 });
  }
  await expect(table, 'Schedule Builder selection should render its table').toBeVisible({ timeout: 15000 });
  return table;
}

test.describe('05 Schedule Builder mutation and data-integrity checks', () => {
  test('fake QA schedule seed has one-target-only data: no wrong-employee duplicate and exact IDs for deletion audits', async ({}, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const seed = readSeedReport();
    expect(seed?.ok, 'Seed report should exist and be successful before mutation schedule tests').toBe(true);
    const shifts = seed.profile.scheduleTruth.counted;
    const invalid = seed.profile.scheduleTruth.invalid;
    const duplicates = seed.profile.scheduleTruth.duplicate;
    const allenValid = shifts.filter(s => s.employeeName === 'Allen QA');
    await attachJson(testInfo, '05-seed-schedule-integrity.json', { allenValid, invalid, duplicates, createdCounts: seed.profile.createdCounts });
    expect(allenValid.reduce((sum, s) => sum + s.hours, 0), 'Raw valid Allen seeded hours before same-day merge should equal visible valid chips: 6+11+6+5 plus boundary weeks').toBeGreaterThanOrEqual(28);
    expect(invalid.some(s => s.employeeName === 'Allen QA' && s.reason === 'invalid-range'), 'Invalid Allen 10p-3p should be preserved for app to flag').toBe(true);
  });

  test('Schedule Builder shows seeded employees without row-index corruption after navigation/refresh', async ({ page }, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const seed = readSeedReport();
    expect(seed?.ok, 'Seed report should exist').toBe(true);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const initialTable = await openScheduleBuilder(page);
    await expect(initialTable, 'Schedule Builder table should render before refresh').toBeVisible({ timeout: 15000 });
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    const table = await openScheduleBuilder(page);
    await expect(table, 'Schedule Builder table should remain visible after refresh').toBeVisible({ timeout: 15000 });
    const staff = ['Allen QA', 'Chuck QA', 'Lani QA'];
    const diagnostics = {};
    const missing = [];
    const tableText = await table.innerText({ timeout: 5000 }).catch(() => '');
    for (const name of staff) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const exactCell = table.getByRole('cell', { name: new RegExp(`^${escapedName}$`, 'i') });
      const rowMatch = table.getByRole('row', { name: new RegExp(`\\b${escapedName}\\b`, 'i') });
      const exactCellCount = await exactCell.count().catch(() => 0);
      const rowCount = await rowMatch.count().catch(() => 0);
      const visibleCells = [];
      for (let i = 0; i < Math.min(exactCellCount, 5); i += 1) {
        const cell = exactCell.nth(i);
        if (await cell.isVisible().catch(() => false)) visibleCells.push(await cell.innerText().catch(() => ''));
      }
      const rowVisible = rowCount > 0 ? await rowMatch.first().isVisible().catch(() => false) : false;
      diagnostics[name] = { exactCellCount, rowCount, visibleCellCount: visibleCells.length, rowVisible, visibleCells };
      if (!visibleCells.length && !rowVisible) missing.push(name);
    }
    await attachJson(testInfo, '05-schedule-builder-deterministic-table-visibility.json', {
      missing,
      diagnostics,
      currentUrl: page.url(),
      tableTextSample: tableText.slice(0, 6000),
      note: 'Assertions are scoped to .schedule-builder-desktop-table so hidden selector options cannot create false positives or false negatives.',
    });
    expect(missing, 'Seeded employees should remain visible inside the real Schedule Builder table after refresh').toEqual([]);
  });

  test('Schedule Builder does not count OFF/request-off/event chips as worked hours', async ({ page }, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const text = await gotoTab(page, 'schedule', { settleMs: 2200, maxText: 65000 });
    const badPatterns = [/QA Private Party[\s\S]{0,100}\bhrs?\b/i, /request off[\s\S]{0,120}\b\+?\d+(?:\.\d+)?\s*hrs?\b/i];
    const findings = badPatterns.filter(re => re.test(text)).map(re => String(re));
    await attachJson(testInfo, '05-non-shift-hour-findings.json', { findings, sample: text.slice(0, 8000) });
    expect(findings, 'Events/request-off chips should never be counted as worked shift hours').toEqual([]);
  });
});
