const { test, expect } = require('@playwright/test');
const {
  RUN_ID, ownerLikeCreds, requireCreds, watchForProblems, login, expectVersion, gotoTab, bodyText, maybeClick,
  assertNoFatal, attachReport, summarizeProblems,
} = require('./utils/deep-helpers');

const FORM_ROUTES = ['today', 'inventory', 'recipes', 'prep', 'financials', 'schedule', 'settings', 'messages', 'help'];

async function exerciseVisibleInputs(page) {
  return await page.evaluate(() => {
    const changed = [];
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && !el.disabled && !el.readOnly;
    };
    for (const input of [...document.querySelectorAll('input:not([type="file"]), textarea')].filter(visible).slice(0, 10)) {
      const old = input.value;
      const safe = /search|filter|command|note|message|post|query|recipe|inventory|email/i.test(`${input.placeholder || ''} ${input.name || ''} ${input.getAttribute('aria-label') || ''} ${input.type || ''}`);
      if (!safe) continue;
      input.focus();
      input.value = input.tagName === 'TEXTAREA' ? 'Deep test typing check' : 'deep test';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      changed.push({ tag: input.tagName.toLowerCase(), type: input.type || '', placeholder: input.placeholder || '', old: String(old || '').slice(0, 40), value: input.value });
    }
    for (const select of [...document.querySelectorAll('select')].filter(visible).slice(0, 8)) {
      if (select.options.length > 1) {
        const old = select.value;
        select.selectedIndex = Math.min(1, select.options.length - 1);
        select.dispatchEvent(new Event('change', { bubbles: true }));
        changed.push({ tag: 'select', old, value: select.value, options: select.options.length });
      }
    }
    return changed;
  });
}

async function clickExportLike(page) {
  const clicked = [];
  for (const name of [/Export/i, /Download/i, /Print/i, /Report/i]) {
    const button = page.getByRole('button', { name }).first();
    if (await button.isVisible({ timeout: 800 }).catch(() => false)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 2500 }).catch(() => null);
      await button.click({ timeout: 3000 }).catch(() => null);
      const download = await downloadPromise;
      clicked.push({ name: String(name), downloadSuggested: download ? await download.suggestedFilename().catch(() => '') : '' });
      await assertNoFatal(page, `after ${name}`);
    }
  }
  return clicked;
}

test.describe('86 Chaos DEEP DEEP forms, exports, and upload surfaces', () => {
  test('search/filter/select/export controls are wired and do not crash their screens', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Desktop forms/export coverage. Mobile uses its own layout suite.');
    test.setTimeout(420000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const reports = [];
    for (const tab of FORM_ROUTES) {
      await gotoTab(page, tab, { settleMs: 1000 });
      const text = await bodyText(page, 30000);
      if (/permission|not available|does not include this tool/i.test(text)) {
        reports.push({ tab, gated: true });
        continue;
      }
      const changed = await exerciseVisibleInputs(page);
      await assertNoFatal(page, `${tab} after form exercise`);
      const exportClicks = await clickExportLike(page);
      const uploadSurfaces = await page.locator('input[type="file"], text=/Drag & drop|Upload|Invoice Scan|Menu Scan/i').count().catch(() => 0);
      const afterText = await bodyText(page, 30000);
      expect(afterText, `${tab} should not show form/export/upload runtime errors`).not.toMatch(/download failed|export failed|print failed|upload crash|undefined.*pdf|undefined.*csv|Cannot read properties/i);
      reports.push({ tab, changed, exportClicks, uploadSurfaces, textStart: afterText.slice(0, 1000) });
    }

    const totalChanges = reports.reduce((n, r) => n + (r.changed?.length || 0) + (r.exportClicks?.length || 0), 0);
    expect(totalChanges, 'Form/export suite did not exercise enough real controls').toBeGreaterThanOrEqual(8);

    await attachReport(testInfo, '07-deep-deep-forms-exports-upload-wiring.json', { runId: RUN_ID, reports, problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
