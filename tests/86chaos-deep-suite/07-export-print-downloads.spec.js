// 86 Chaos 15.0.96 export/print/download route checks.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  ownerLikeCreds,
  requireCreds,
  watchForProblems,
  login,
  expectVersion,
  expectRouteHealthy,
  bodyText,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

const EXPORT_WORD_RE = /Export|Download|Print|CSV|PDF|Report|Accountant Packet|Owner Summary/i;

test.describe('86 Chaos Export / Print / Downloads', () => {
  test('export/report controls are present where expected and do not crash rendering', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const reports = [];
    for (const tab of ['financials', 'back-office', 'inventory', 'schedule']) {
      const result = await expectRouteHealthy(page, tab);
      const text = await bodyText(page);
      reports.push({ tab, gated: result.gated, unavailable: result.unavailable, hasExportControl: EXPORT_WORD_RE.test(text), textStart: text.slice(0, 1200) });
    }

    const anyExportControls = reports.some((r) => r.hasExportControl || r.gated || r.unavailable);
    expect(anyExportControls, 'At least one owner route should expose export/report/download/print controls, or valid gates for unavailable tools').toBeTruthy();

    for (const report of reports) {
      expect(report.textStart, `${report.tab} should not render export/download errors`).not.toMatch(/download failed|export failed|print failed|undefined.*pdf|undefined.*csv/i);
    }

    await attachReport(testInfo, '07-export-print-downloads-report.json', { runId: RUN_ID, reports, problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
