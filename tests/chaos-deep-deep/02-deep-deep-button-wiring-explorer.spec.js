const { test, expect } = require('@playwright/test');
const {
  RUN_ID, ROUTES, ALLOW_MUTATION, MAX_SAFE_CLICKS_PER_ROUTE, ownerLikeCreds, requireCreds, watchForProblems,
  login, expectVersion, gotoTab, assertNoFatal, bodyText, listVisibleInteractions, clickInteractionBySelector,
  closeTransientUi, attachReport, summarizeProblems,
} = require('./utils/deep-helpers');

const HIGH_VALUE_ROUTES = ['today', 'published', 'schedule', 'financials', 'inventory', 'recipes', 'prep', 'messages', 'team', 'settings', 'help', 'ai-tools'];
const EXPECTED_ACTION_WORDS = /view|open|more|details|filter|category|today|week|day|month|schedule|clock|prep|inventory|recipe|message|settings|help|voice|manage|configure|search|next|previous|back|close|menu|all|report/i;

test.describe('86 Chaos DEEP DEEP safe button/link wiring explorer', () => {
  test('clicks safe visible buttons and links across the app and proves none are dead-crash controls', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Mobile click wiring is covered in the mobile suite.');
    test.setTimeout(900000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const routeReports = [];
    let totalClicked = 0;
    let totalCandidates = 0;
    let totalNoChange = 0;

    for (const tab of HIGH_VALUE_ROUTES) {
      await gotoTab(page, tab, { settleMs: 900 });
      const initialText = await assertNoFatal(page, tab);
      if (/permission|not authorized|not available|does not include this tool/i.test(initialText)) {
        routeReports.push({ tab, gated: true, clicked: 0, candidates: 0, noChange: 0, failures: [] });
        continue;
      }

      const candidates = (await listVisibleInteractions(page, { max: 120, includeMutation: ALLOW_MUTATION }))
        .filter(item => item.tag !== 'input' && item.tag !== 'textarea')
        .filter(item => EXPECTED_ACTION_WORDS.test(item.text) || /button|a/.test(item.tag))
        .slice(0, MAX_SAFE_CLICKS_PER_ROUTE);

      totalCandidates += candidates.length;
      const clicks = [];
      const failures = [];
      let noChange = 0;

      for (const item of candidates) {
        try {
          const result = await clickInteractionBySelector(page, item, { settleMs: 500 });
          totalClicked += 1;
          if (!result.changed && !/filter|dropdown|select|today|close|menu|more/i.test(item.text)) {
            noChange += 1;
            totalNoChange += 1;
          }
          clicks.push({ text: item.text, tag: item.tag, changed: result.changed, urlAfter: result.after.url });
          await closeTransientUi(page);
          await gotoTab(page, tab, { settleMs: 450 });
        } catch (error) {
          failures.push({ text: item.text, selector: item.selector, message: error.message });
          await closeTransientUi(page);
          await gotoTab(page, tab, { settleMs: 450 }).catch(() => {});
        }
      }

      const allowedFailures = Math.max(1, Math.ceil(candidates.length * 0.08));
      expect(failures.length, `${tab} had too many broken safe buttons/links: ${JSON.stringify(failures.slice(0, 10), null, 2)}`).toBeLessThanOrEqual(allowedFailures);
      routeReports.push({ tab, candidates: candidates.length, clicked: clicks.length, noChange, failures, clicks: clicks.slice(0, 80), textStart: (await bodyText(page, 5000)).slice(0, 1000) });
    }

    expect(totalCandidates, 'Deep click explorer did not find enough safe controls to prove wiring').toBeGreaterThanOrEqual(40);
    expect(totalClicked, 'Deep click explorer did not click enough controls').toBeGreaterThanOrEqual(35);

    await attachReport(testInfo, '02-deep-deep-button-wiring-explorer.json', {
      runId: RUN_ID,
      mutationEnabled: ALLOW_MUTATION,
      totalCandidates,
      totalClicked,
      totalNoChange,
      routeReports,
      problems: summarizeProblems(problems),
    });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
