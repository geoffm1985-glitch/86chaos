const { test, expect } = require('@playwright/test');
const {
  ROUTE_SPECS,
  ownerLikeCreds,
  requireCreds,
  login,
  gotoTab,
  clickSafeButtons,
  attachJson,
  PERMISSION_GATE_RE,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

function mergeRanges(ranges) {
  const sorted = ranges.filter(r => r.count > 0 && r.endOffset > r.startOffset).map(r => [r.startOffset, r.endOffset]).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range[0] > last[1]) merged.push(range);
    else last[1] = Math.max(last[1], range[1]);
  }
  return merged;
}

function sumRanges(ranges) { return ranges.reduce((sum, [a, b]) => sum + Math.max(0, b - a), 0); }

test.describe('21 Chromium runtime execution coverage', () => {
  test('route and safe-interaction crawl executes the required share of shipped application JavaScript', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'V8 coverage is collected on the desktop chromium project only.');
    test.setTimeout(30 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');

    await page.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: false });
    await page.coverage.startCSSCoverage({ resetOnNavigation: false });
    await login(page, account.email, account.password);

    for (const route of ROUTE_SPECS) {
      const text = await gotoTab(page, route.tab, { settleMs: 800 });
      if (PERMISSION_GATE_RE.test(text)) continue;
      await clickSafeButtons(page, testInfo, { tab: `coverage-${route.tab}`, maxButtons: 24 }).catch(() => {});
      await gotoTab(page, route.tab, { settleMs: 300 });
    }

    const js = await page.coverage.stopJSCoverage();
    const css = await page.coverage.stopCSSCoverage();
    const base = new URL(process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.BASE_URL);
    const appScripts = js.filter(entry => {
      try {
        const url = new URL(entry.url);
        return url.host === base.host && (/\/static\/js\//.test(url.pathname) || /\/src\//.test(url.pathname));
      } catch (_) { return false; }
    });
    const perScript = appScripts.map(entry => {
      const ranges = mergeRanges(entry.functions.flatMap(fn => fn.ranges || []));
      const totalBytes = Buffer.byteLength(entry.source || '', 'utf8');
      const coveredBytes = sumRanges(ranges);
      return { url: entry.url, totalBytes, coveredBytes, percent: totalBytes ? Number((coveredBytes / totalBytes * 100).toFixed(2)) : 0 };
    });
    const totals = perScript.reduce((acc, row) => ({ totalBytes: acc.totalBytes + row.totalBytes, coveredBytes: acc.coveredBytes + row.coveredBytes }), { totalBytes: 0, coveredBytes: 0 });
    totals.percent = totals.totalBytes ? Number((totals.coveredBytes / totals.totalBytes * 100).toFixed(2)) : 0;
    const threshold = Number(process.env.CHAOS_MIN_RUNTIME_JS_COVERAGE || 80);

    await attachJson(testInfo, '21-runtime-js-coverage.json', { threshold, totals, perScript: perScript.sort((a, b) => a.percent - b.percent), cssFiles: css.map(x => x.url) });
    expect(appScripts.length, 'Coverage must capture application scripts; a zero-script report is invalid').toBeGreaterThan(0);
    expect(totals.percent, `Runtime JavaScript execution coverage must be at least ${threshold}%`).toBeGreaterThanOrEqual(threshold);
  });
});
