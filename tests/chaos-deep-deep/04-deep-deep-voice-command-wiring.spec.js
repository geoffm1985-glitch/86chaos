const { test, expect } = require('@playwright/test');
const {
  RUN_ID, ownerLikeCreds, requireCreds, watchForProblems, login, expectVersion, gotoTab, bodyText, maybeClick,
  assertNoFatal, attachReport, summarizeProblems,
} = require('./utils/deep-helpers');

async function voiceButtonMetrics(page) {
  return await page.evaluate(() => {
    const btn = document.querySelector('.reference-voice-action') || [...document.querySelectorAll('button')].find(b => /Voice|86Voice|Command/i.test(b.innerText || b.getAttribute('aria-label') || b.title || ''));
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const s = getComputedStyle(btn);
    return { width: r.width, height: r.height, backgroundColor: s.backgroundColor, borderColor: s.borderColor, color: s.color, text: (btn.innerText || btn.getAttribute('aria-label') || btn.title || '').trim() };
  });
}

async function openVoice(page) {
  const byClass = await maybeClick(page, page.locator('.reference-voice-action').first(), { force: true, settleMs: 1100 });
  if (byClass) return true;
  return await maybeClick(page, page.getByRole('button', { name: /86Voice|Voice Command|Command/i }).first(), { force: true, settleMs: 1100 });
}

test.describe('86 Chaos DEEP DEEP 86Voice wiring', () => {
  test('top mic is copper/bigger and opens the real 86Voice dock from key screens', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Mobile top-bar chrome is covered by mobile navigation tests.');
    test.setTimeout(300000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const reports = [];
    for (const tab of ['today', 'prep', 'inventory', 'settings']) {
      await gotoTab(page, tab, { settleMs: 900 });
      const metrics = await voiceButtonMetrics(page);
      expect(metrics, `${tab} should expose a top-bar 86Voice button`).toBeTruthy();
      expect(metrics.width, `${tab} 86Voice button should be larger than a tiny icon`).toBeGreaterThanOrEqual(48);
      expect(metrics.height, `${tab} 86Voice button should be easy to tap/click`).toBeGreaterThanOrEqual(42);
      const colorBlob = `${metrics.backgroundColor} ${metrics.borderColor} ${metrics.color}`;
      expect(colorBlob, `${tab} 86Voice button should use the app copper/orange styling`).toMatch(/rgb\((1[4-9]\d|2[0-5]\d),\s*(8\d|9\d|1[0-8]\d),\s*(4\d|5\d|6\d|7\d|8\d|9\d|1[0-7]\d)\)|#d4a381|#c47c3f|#b87333/i);

      const opened = await openVoice(page);
      expect(opened, `${tab} 86Voice button should be clickable`).toBeTruthy();
      const text = await assertNoFatal(page, `${tab} after opening 86Voice`);
      expect(text, `${tab} should open the real 86Voice dock, not merely navigate to a placeholder`).toMatch(/86 Voice|Start Listening|Parse Typed Command|Try:|Suggested Action|Voice Command/i);
      expect(text, `${tab} voice dock should expose typed command workflow`).toMatch(/Parse Typed Command|Try:/i);
      reports.push({ tab, metrics, textStart: text.slice(0, 1200) });
      await page.keyboard.press('Escape').catch(() => {});
    }

    await attachReport(testInfo, '04-deep-deep-voice-command-wiring.json', { runId: RUN_ID, reports, problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
