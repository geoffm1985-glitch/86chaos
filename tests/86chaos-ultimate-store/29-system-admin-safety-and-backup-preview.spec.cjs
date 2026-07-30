const { test, expect } = require('@playwright/test');
const {
  creds,
  requireCreds,
  login,
  gotoTab,
  bodyText,
  expectNoFatal,
  attachJson,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('29 System Administrator safety, backups, and protected-root evidence', () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'chromium-full', 'Runs once with the server-verified System Administrator account.'));

  test('protected founding System Administrator is visibly non-revocable and destructive controls do not target it', async ({ page }, testInfo) => {
    test.setTimeout(10 * 60 * 1000);
    const account = creds('SYSTEM_ADMIN');
    requireCreds(account, 'System Administrator');
    await login(page, account.email, account.password);
    await gotoTab(page, 'godmode', { settleMs: 1200, timeout: 60_000 });
    await expectNoFatal(page, 'System Administrator protected account review');

    const text = await bodyText(page, 60_000);
    expect(text).toMatch(/System Administrator/i);
    const protectedEvidence = /Protected Founding System Administrator|protected root administrator|cannot be revoked|non-revocable/i.test(text);
    const emailVisible = /geoffm1985@gmail\.com/i.test(text);
    expect(protectedEvidence || emailVisible, 'Platform tools should expose protected-root administrator evidence').toBeTruthy();

    const dangerousTargets = await page.locator('button:visible').evaluateAll((buttons) => buttons.map(button => ({
      text: (button.innerText || button.getAttribute('aria-label') || '').trim(),
      disabled: button.disabled,
      title: button.getAttribute('title') || '',
    })).filter(row => /revoke|demote|delete|disable|remove/i.test(`${row.text} ${row.title}`)));
    const unsafeProtectedButtons = dangerousTargets.filter(row => /geoffm1985|protected founding/i.test(`${row.text} ${row.title}`) && !row.disabled);
    expect(unsafeProtectedButtons, 'No enabled destructive control may target the protected founding administrator').toEqual([]);
    await attachJson(testInfo, 'protected-root-admin-ui-evidence.json', { protectedEvidence, emailVisible, dangerousTargets, textSample: text.slice(0, 8000) });
  });

  test('backup and restore surfaces are review-first and require explicit confirmation before mutation', async ({ page }, testInfo) => {
    test.setTimeout(10 * 60 * 1000);
    const account = creds('SYSTEM_ADMIN');
    requireCreds(account, 'System Administrator');
    await login(page, account.email, account.password);
    await gotoTab(page, 'godmode', { settleMs: 1200, timeout: 60_000 });

    const backupTrigger = page.getByRole('button', { name: /backup|recovery/i }).first();
    if (await backupTrigger.isVisible({ timeout: 4000 }).catch(() => false)) {
      await backupTrigger.click().catch(() => {});
      await page.waitForTimeout(800);
    }
    const text = await bodyText(page, 60_000);
    expect(text).toMatch(/Backup|Recovery|Restore|Preview|Integrity/i);
    expect(text).not.toMatch(/restore completed|restored successfully/i);

    const restoreButtons = page.getByRole('button', { name: /restore/i });
    const count = await restoreButtons.count();
    const rows = [];
    for (let index = 0; index < Math.min(count, 20); index += 1) {
      const button = restoreButtons.nth(index);
      if (!await button.isVisible().catch(() => false)) continue;
      rows.push(await button.evaluate(element => ({
        text: (element.innerText || element.getAttribute('aria-label') || '').trim(),
        disabled: element.disabled,
        title: element.getAttribute('title') || '',
      })));
    }
    const suspicious = rows.filter(row => !row.disabled && /^restore$/i.test(row.text) && !/preview|select|drill|confirm/i.test(`${row.text} ${row.title}`));
    expect(suspicious, 'Restore actions should be gated by selection, preview, drill, or confirmation').toEqual([]);
    await expectNoFatal(page, 'Backup and recovery review');
    await attachJson(testInfo, 'backup-restore-safety.json', { rows, textSample: text.slice(0, 10_000) });
  });
});
