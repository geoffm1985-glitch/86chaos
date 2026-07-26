const { test, expect } = require('@playwright/test');
const {
  ROUTE_SPECS,
  ownerLikeCreds,
  requireCreds,
  login,
  gotoTab,
  attachJson,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

function classify(req) {
  const url = req.url();
  const method = req.method();
  if (!/firestore|googleapis|firebaseio|identitytoolkit|securetoken|presence|push-token|safe-write/i.test(url)) return null;
  let kind = 'other';
  if (/Listen\/channel|google\.firestore\.v1\.Firestore\/Listen|channel\?VER=/i.test(url)) kind = 'listen';
  else if (/Write\/channel|google\.firestore\.v1\.Firestore\/Write|commit/i.test(url) || /POST|PATCH|PUT|DELETE/i.test(method) && /firestore/i.test(url)) kind = 'write';
  else if (/BatchGetDocuments|RunQuery|documents\//i.test(url)) kind = 'read';
  else if (/presence/i.test(url)) kind = 'presence';
  return { method, url: url.split('?')[0].slice(0, 260), kind };
}

test.describe('20 Firebase read/write and idempotency release gate', () => {
  test('opening and reopening unchanged routes does not create write storms or duplicate listener churn', async ({ page }, testInfo) => {
    test.setTimeout(18 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    const traffic = [];
    page.on('request', req => { const row = classify(req); if (row) traffic.push({ at: Date.now(), ...row }); });
    await login(page, account.email, account.password);

    traffic.length = 0;
    const perRoute = [];
    for (const route of ROUTE_SPECS) {
      const start = traffic.length;
      await gotoTab(page, route.tab, { settleMs: 700 });
      const first = traffic.slice(start);
      const secondStart = traffic.length;
      await gotoTab(page, route.tab, { settleMs: 500 });
      const second = traffic.slice(secondStart);
      perRoute.push({
        route: route.tab,
        first: countKinds(first),
        second: countKinds(second),
      });
    }

    const writeStorms = perRoute.filter(x => x.second.write > Number(process.env.CHAOS_MAX_NOOP_ROUTE_WRITES || 2));
    const listenerStorms = perRoute.filter(x => x.second.listen > Number(process.env.CHAOS_MAX_REPEAT_ROUTE_LISTENS || 6));
    const grouped = {};
    for (const row of traffic) grouped[`${row.kind} ${row.method} ${row.url}`] = (grouped[`${row.kind} ${row.method} ${row.url}`] || 0) + 1;
    const highRepeats = Object.entries(grouped).filter(([, count]) => count > 50).map(([key, count]) => ({ key, count }));

    await attachJson(testInfo, '20-firebase-cost-idempotency.json', { perRoute, writeStorms, listenerStorms, highRepeats, grouped, totalTraffic: traffic.length });
    expect(writeStorms, 'Reopening an unchanged route should not perform Firestore writes except narrowly documented presence/token refresh').toEqual([]);
    expect(listenerStorms, 'Reopening an unchanged route should reuse or gracefully retain listeners rather than resubscribe repeatedly').toEqual([]);
    expect(highRepeats, 'No Firebase endpoint should enter a rapid retry/listen/write loop during one route sweep').toEqual([]);
  });
});

function countKinds(rows) {
  return rows.reduce((acc, row) => { acc[row.kind] = (acc[row.kind] || 0) + 1; return acc; }, { listen: 0, write: 0, read: 0, presence: 0, other: 0 });
}
