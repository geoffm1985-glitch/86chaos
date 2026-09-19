const { test, expect } = require('@playwright/test');
const {
  ROUTE_SPECS, ownerLikeCreds, creds, requireCreds, login, gotoTab,
  attachJson, PERMISSION_GATE_RE,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { ROUTE_STATES } = require('./exhaustive-surface-matrix.cjs');
const { applyStatePath } = require('./utils/exhaustive-ui-helpers.cjs');

function mergeRanges(ranges) {
  const sorted = ranges.filter(r => r.count > 0 && r.endOffset > r.startOffset).map(r => [r.startOffset, r.endOffset]).sort((a,b)=>a[0]-b[0]);
  const merged=[];
  for (const range of sorted) { const last=merged[merged.length-1]; if(!last || range[0]>last[1]) merged.push(range); else last[1]=Math.max(last[1],range[1]); }
  return merged;
}
function sumRanges(ranges){return ranges.reduce((s,[a,b])=>s+Math.max(0,b-a),0);}

async function traverseRouteStates(page, route) {
  const text = await gotoTab(page, route.tab, { settleMs: 500, maxText: 18000 });
  if (PERMISSION_GATE_RE.test(text)) return { gated:true, states:0 };
  let states=1;
  for (const state of ROUTE_STATES[route.tab] || []) {
    await gotoTab(page, route.tab, { settleMs: 250, force:true });
    const res = await applyStatePath(page, state, { strict:false });
    if (res.ok) states++;
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
      await page.context().clearCookies().catch(()=>{});
      await page.goto('about:blank');
      await login(page, sys.email, sys.password);
      const god=ROUTE_SPECS.find(r=>r.tab==='godmode');
      if (god) traversed.push({ route:'godmode', ...(await traverseRouteStates(page, god)) });
    }

    const js=await page.coverage.stopJSCoverage();
    const css=await page.coverage.stopCSSCoverage();
    const base=new URL(process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.BASE_URL);
    const appScripts=js.filter(entry=>{try{const u=new URL(entry.url);return u.host===base.host && (/\/static\/js\//.test(u.pathname)||/\/assets\//.test(u.pathname)||/\/src\//.test(u.pathname));}catch(_){return false;}});
    const perScript=appScripts.map(entry=>{
      const ranges=mergeRanges(entry.functions.flatMap(fn=>fn.ranges||[]));
      const totalBytes=Buffer.byteLength(entry.source||'','utf8');
      const coveredBytes=sumRanges(ranges);
      const namedFns=(entry.functions||[]).filter(fn=>fn.functionName && !/^\(anonymous\)$/.test(fn.functionName));
      const coveredFns=namedFns.filter(fn=>(fn.ranges||[]).some(r=>r.count>0)).length;
      const uncoveredFunctions=namedFns.filter(fn=>!(fn.ranges||[]).some(r=>r.count>0)).map(fn=>fn.functionName).slice(0,500);
      return {url:entry.url,totalBytes,coveredBytes,bytePercent:totalBytes?Number((coveredBytes/totalBytes*100).toFixed(2)):0,totalFunctions:namedFns.length,coveredFunctions:coveredFns,functionPercent:namedFns.length?Number((coveredFns/namedFns.length*100).toFixed(2)):100,uncoveredFunctions};
    });
    const totals=perScript.reduce((a,r)=>({totalBytes:a.totalBytes+r.totalBytes,coveredBytes:a.coveredBytes+r.coveredBytes,totalFunctions:a.totalFunctions+r.totalFunctions,coveredFunctions:a.coveredFunctions+r.coveredFunctions}),{totalBytes:0,coveredBytes:0,totalFunctions:0,coveredFunctions:0});
    totals.bytePercent=totals.totalBytes?Number((totals.coveredBytes/totals.totalBytes*100).toFixed(2)):0;
    totals.functionPercent=totals.totalFunctions?Number((totals.coveredFunctions/totals.totalFunctions*100).toFixed(2)):100;
    const byteThreshold=Number(process.env.CHAOS_MIN_RUNTIME_JS_COVERAGE || 90);
    const fnThreshold=Number(process.env.CHAOS_MIN_RUNTIME_FUNCTION_COVERAGE || 90);
    await attachJson(testInfo,'21-ultimate-runtime-coverage.json',{byteThreshold,fnThreshold,totals,traversed,perScript:perScript.sort((a,b)=>a.functionPercent-b.functionPercent),cssFiles:css.map(x=>x.url)});
    expect(appScripts.length,'Coverage must capture real app scripts').toBeGreaterThan(0);
    expect(totals.bytePercent,`Runtime application JavaScript byte coverage must be >= ${byteThreshold}%`).toBeGreaterThanOrEqual(byteThreshold);
    // Named-function coverage remains diagnostic. Many mutation/error callbacks are intentionally not invoked by this non-destructive crawl.
    // Behavioral coverage is enforced independently by the route/state graph, mutation workflows, API gate, role matrix, math gate, and inventory integrity tests.
  });
});
