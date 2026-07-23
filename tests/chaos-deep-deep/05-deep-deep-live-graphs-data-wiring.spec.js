const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
  RUN_ID, ownerLikeCreds, requireCreds, watchForProblems, login, expectVersion, expectRouteHealthy,
  pageMetrics, attachReport, summarizeProblems,
} = require('./utils/deep-helpers');

const GRAPH_ROUTES = [
  { tab: 'today', minCharts: 4, expect: /Sales Today|Labor|Forecast|Food Cost|Prep|Low Stock/i },
  { tab: 'financials', minCharts: 3, expect: /Sales|Labor|Net Sales|Gross Profit|Daily Ledger/i, mayGate: true },
  { tab: 'inventory', minCharts: 3, expect: /Inventory|Stock|Par|Vendor|Burn|Invoice/i, mayGate: true },
  { tab: 'recipes', minCharts: 2, expect: /Recipe|Margin|Food Cost|Menu Cost/i, mayGate: true },
  { tab: 'prep', minCharts: 2, expect: /Prep|Task|Completion|86/i, mayGate: true },
  { tab: 'schedule', minCharts: 2, expect: /Schedule|Coverage|Labor|Open Shifts/i, mayGate: true },
];

async function graphDiagnostics(page) {
  return await page.evaluate(() => {
    const text = document.body.innerText || '';
    const liveLineCharts = [...document.querySelectorAll('.ref-chart-line.live')].map((el, idx) => ({
      idx,
      aria: el.querySelector('svg')?.getAttribute('aria-label') || '',
      polylines: [...el.querySelectorAll('polyline')].map(p => p.getAttribute('points') || ''),
      text: el.innerText.replace(/\s+/g, ' ').trim().slice(0, 250),
    }));
    const liveBars = document.querySelectorAll('.ref-live-bars > div').length;
    const donuts = [...document.querySelectorAll('.ref-donut')].map(el => ({ text: el.innerText.replace(/\s+/g, ' ').trim(), value: getComputedStyle(el).getPropertyValue('--value') }));
    const sparks = [...document.querySelectorAll('.ref-spark')].map(el => ({ title: el.getAttribute('title') || '', bars: el.querySelectorAll('i').length }));
    const progress = document.querySelectorAll('.ref-progress i, [class*="progress"] i').length;
    const emptyLive = [...document.querySelectorAll('.ref-empty-live')].map(el => el.innerText.replace(/\s+/g, ' ').trim());
    const staticWarnings = /static fake|placeholder graph|mock graph|hardcoded graph|display-only/i.test(text);
    const nanOrBadMath = /\bNaN\b|Infinity%|undefined%|\$NaN|\$undefined/i.test(text);
    return { liveLineCharts, liveBars, donuts, sparks, progress, emptyLive, staticWarnings, nanOrBadMath, textStart: text.replace(/\s+/g, ' ').trim().slice(0, 1400) };
  });
}

test.describe('86 Chaos DEEP DEEP live graph/data wiring', () => {
  test('source chart layer uses computed live primitives instead of hardcoded static art', async ({}, testInfo) => {
    const referencePath = path.resolve(process.cwd(), 'src/features/reference.jsx');
    const appPath = path.resolve(process.cwd(), 'src/App.js');
    const reference = fs.readFileSync(referencePath, 'utf8');
    const app = fs.readFileSync(appPath, 'utf8');

    expect(reference, 'reference.jsx should include live chart primitives').toMatch(/LiveLineChart|LiveBarChart|dailySeries|EmptyLive|hasSeriesData/);
    expect(reference, 'line charts should not be hardcoded SVG point strings').not.toMatch(/<polyline\s+points=["']\d+,\d+\s+\d+,/i);
    expect(reference, 'sparkline metrics should accept live points arrays').toMatch(/MiniSpark[\s\S]*points/);
    expect(app, 'global CSS should include the 15.1.13 live graph primitive styles').toMatch(/live graph primitives|ref-chart-line\.live|ref-live-bars/i);

    await testInfo.attach('05-source-live-graph-contract.json', {
      body: JSON.stringify({ referencePath, appPath, referenceBytes: reference.length, appBytes: app.length }, null, 2),
      contentType: 'application/json',
    });
  });

  test('graph-heavy pages render live charts or explicit live-empty states without fake math', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Mobile graph containment is checked in the mobile suite.');
    test.setTimeout(420000);
    const account = ownerLikeCreds();
    requireCreds(test, account, 'OWNER or TEST_OWNER');

    const problems = [];
    watchForProblems(page, problems);
    await login(page, account.email, account.password);
    await expectVersion(page);

    const reports = [];
    for (const route of GRAPH_ROUTES) {
      const result = await expectRouteHealthy(page, route, { settleMs: 1000 });
      const metrics = await pageMetrics(page);
      const graphs = await graphDiagnostics(page);
      const gated = result.gated || result.unavailable;
      if (!gated) {
        expect(metrics.charts, `${route.tab} should expose graph/chart primitives`).toBeGreaterThanOrEqual(route.minCharts);
        expect(graphs.nanOrBadMath, `${route.tab} should not display NaN/undefined graph math`).toBeFalsy();
        expect(graphs.staticWarnings, `${route.tab} should not advertise static/display-only graphs`).toBeFalsy();
        for (const chart of graphs.liveLineCharts) {
          expect(chart.aria, `${route.tab} live line chart should expose an aria label`).toMatch(/live chart/i);
          for (const points of chart.polylines) expect(points, `${route.tab} live chart polyline should have generated points`).toMatch(/\d+(\.\d+)?,\d+(\.\d+)?/);
        }
        expect(graphs.liveLineCharts.length + graphs.liveBars + graphs.donuts.length + graphs.sparks.length + graphs.progress + graphs.emptyLive.length, `${route.tab} should render live data charts or live-empty states`).toBeGreaterThan(0);
      }
      reports.push({ tab: route.tab, gated, metrics, graphs });
    }

    await attachReport(testInfo, '05-deep-deep-live-graphs-data-wiring.json', { runId: RUN_ID, reports, problems: summarizeProblems(problems) });
    expect(problems, JSON.stringify(summarizeProblems(problems), null, 2)).toEqual([]);
  });
});
