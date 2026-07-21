// 86 Chaos Backup / Restore / Admin Safety Deep Test
// Opens System Administrator surfaces. Destructive restore is blocked unless PLAYWRIGHT_ALLOW_RESTORE_DRILL=true.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  ownerLikeCreds,
  watchForProblems,
  login,
  gotoTab,
  bodyText,
  assertNoUnavailablePage,
  expectAnyText,
  clickButtonIfPresent,
  closeBlockingModals,
  attachReport,
} = require('./utils/chaos-helpers');

const ALLOW_RESTORE_DRILL = String(process.env.PLAYWRIGHT_ALLOW_RESTORE_DRILL || '').toLowerCase() === 'true';

test.describe('86 Chaos Backup / Restore / Admin Safety Deep Test', () => {
  test('system admin, backup, restore safety, security, python automation, and audit surfaces', async ({ page }, testInfo) => {
    test.setTimeout(300000);
    const problems = [];
    const report = { runId: RUN_ID, actions: [] };
    watchForProblems(page, problems, { acceptDialogs: ALLOW_RESTORE_DRILL });
    const account = ownerLikeCreds();
    await login(page, account.email, account.password);

    await gotoTab(page, 'godmode').catch((error) => problems.push({ type: 'godmode-open-failed', message: error.message, url: page.url() }));
    await assertNoUnavailablePage(page, problems, 'System Administrator');
    await expectAnyText(page, [/System Administrator|Backup|Security|Python|Forensics|Diagnostics|Push|Deployment|Audit/i], problems, 'System Administrator text');

    const adminButtons = [/Overview/i, /Backup/i, /Security/i, /Python Automation/i, /Push/i, /Forensics/i, /Diagnostics/i, /Deployment/i, /Permission/i, /Role/i];
    for (const button of adminButtons) {
      await clickButtonIfPresent(page, button, report.actions, `Godmode ${button}`, { exact: false }).catch((error) => {
        problems.push({ type: 'godmode-button-failed', button: String(button), message: error.message, url: page.url() });
      });
      const text = await bodyText(page);
      if (/undefined|NaN|TypeError|ReferenceError/i.test(text)) problems.push({ type: 'godmode-visible-error', button: String(button), textStart: text.slice(0, 900), url: page.url() });
      await closeBlockingModals(page);
    }

    // Backup actions are okay; restore should require confirmation and is not clicked unless explicitly allowed.
    const backupButton = page.locator('main').getByRole('button', { name: /run backup|create backup|backup now|manual backup/i }).first();
    if (await backupButton.isVisible({ timeout: 2500 }).catch(() => false)) {
      await backupButton.click({ timeout: 7000 }).catch((error) => report.actions.push({ action: 'backup-click-failed', error: error.message }));
      await page.waitForTimeout(1500);
      report.actions.push({ action: 'backup-click-attempted' });
      await closeBlockingModals(page);
    }

    const restoreButton = page.locator('main').getByRole('button', { name: /restore/i }).first();
    if (await restoreButton.isVisible({ timeout: 2500 }).catch(() => false)) {
      if (ALLOW_RESTORE_DRILL) {
        await restoreButton.click({ timeout: 7000 }).catch((error) => problems.push({ type: 'restore-click-failed', message: error.message, url: page.url() }));
        report.actions.push({ action: 'restore-drill-clicked', allowedByEnv: true });
      } else {
        report.actions.push({ action: 'restore-visible-not-clicked', reason: 'PLAYWRIGHT_ALLOW_RESTORE_DRILL not true' });
      }
    }

    await gotoTab(page, 'audit').catch(() => {});
    const auditText = await bodyText(page);
    report.auditTextStart = auditText.slice(0, 900);
    if (/Audit|Forensics|Action|Timeline|Admin/i.test(auditText)) report.actions.push({ action: 'audit-surface-visible' });

    await attachReport(testInfo, 'backup-restore-admin-safety-report.json', { report, problems });
    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });
});
