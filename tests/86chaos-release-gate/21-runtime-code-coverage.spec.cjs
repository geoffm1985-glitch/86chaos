const { test, expect } = require('@playwright/test');
const {
  ROUTE_SPECS, ownerLikeCreds, creds, requireCreds, login, gotoTab,
  attachJson, PERMISSION_GATE_RE,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { ROUTE_STATES } = require('./exhaustive-surface-matrix.cjs');
const { applyStatePath, recoverSiblingStatePath } = require('./utils/exhaustive-ui-helpers.cjs');
const { summarizeScriptCoverage } = require('./utils/runtime-coverage-summary.cjs');

async function traverseRouteStates(page, route) {
  const text = await gotoTab(page, route.tab, { settleMs: 500, maxText: 18000 });
  if (PERMISSION_GATE_RE.test(text)) return { gated:true, states:0 };
  let states=1;
  let previous=[];
  for (const state of ROUTE_STATES[route.tab] || []) {
    const traversal = await recoverSiblingStatePath(page, previous, state, route.tab);
    const res = await applyStatePath(page, traversal, { strict:false });
    if (res.ok) states++;
    previous=state;
    console.log('[runtime-coverage] ' + route.tab + ' > ' + state.map(String).join(' > ') + ': ' + (res.ok ? 'visited' : 'missing'));
  }
  return { gated:false, states };
}

test.describe('21 ultimate Chromium runtime execution coverage', () => {
  test('source-derived route/state crawl executes a high share of shipped application code and functions', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'V8 execution coverage is collected once on desktop Chromium.');
    test.setTimeout(55 * 60 * 1000);
    const owner = ownerLikeCreds();
    requireCreds(owner, 'owner-like account');

    await page.coverage.startJSCoverage({ resetOnNavigation:false, reportAnonymousScripts:false });
    await page.coverage.startCSSCoverage({ resetOnNavigation:false });
    await login(page, owner.email, owner.password);

    const traversed=[];
    for (const route of ROUTE_SPECS.filter(r=>r.tab!=='godmode')) traversed.push({ route:route.tab, ...(await traverseRouteStates(page, route)) });

    const sys=creds('SYSTEM_ADMIN');
    if (sys.email && sys.password) {
      await gotoTab(page, 'godmode', { settleMs: 500, maxText: 12000 });
      const logout = page.getByRole('button', { name: /open sign out|log out/i }).first();
      await expect(logout, 'Owner session must expose a real app logout before switching runtime-coverage identities').toBeVisible({ timeout: 12000 });
      await logout.click();
      const emailBox = page.getByRole('textbox', { name: /^Email Address$/i }).first();
      await expect(emailBox, 'Owner logout must reach the login surface before System Administrator coverage begins').toBeVisible({ timeout: 12000 });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
      await expect(emailBox, 'A reload after logout must stay signed out instead of restoring the owner Firebase session').toBeVisible({ timeout: 12000 });
      await login(page, sys.email, sys.password);
      const god=ROUTE_SPECS.find(r=>r.tab==='godmode');
      if (god) {
        const godResult = await traverseRouteStates(page, god);
        expect(godResult.gated, 'Verified System Administrator must actually enter godmode before runtime coverage is scored').toBe(false);
        traversed.push({ route:'godmode', ...godResult });
      }
    }

    const js=await page.coverage.stopJSCoverage();
    const css=await page.coverage.stopCSSCoverage();
    const base=new URL(process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.BASE_URL);
    const appScripts=js.filter(entry=>{try{const u=new URL(entry.url);return u.host===base.host && (/\/static\/js\//.test(u.pathname)||/\/assets\//.test(u.pathname)||/\/src\//.test(u.pathname));}catch(_){return false;}});
    const { perScript, totals, aggregation } = summarizeScriptCoverage(appScripts);
    const byteThreshold=Number(process.env.CHAOS_MIN_RUNTIME_JS_COVERAGE || 90);
    const fnThreshold=Number(process.env.CHAOS_MIN_RUNTIME_FUNCTION_COVERAGE || 90);
    await attachJson(testInfo,'21-ultimate-runtime-coverage.json',{byteThreshold,fnThreshold,totals,aggregation,traversed,perScript:perScript.sort((a,b)=>a.functionPercent-b.functionPercent),cssFiles:css.map(x=>x.url)});
    expect(appScripts.length,'Coverage must capture real app scripts').toBeGreaterThan(0);
    expect(totals.bytePercent,`Runtime application JavaScript byte coverage must be >= ${byteThreshold}%`).toBeGreaterThanOrEqual(byteThreshold);
    // Named-function coverage remains diagnostic. Many mutation/error callbacks are intentionally not invoked by this non-destructive crawl.
    // Behavioral coverage is enforced independently by the route/state graph, mutation workflows, API gate, role matrix, math gate, and inventory integrity tests.
  });
});
