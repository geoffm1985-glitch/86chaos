const { test, expect } = require('@playwright/test');
const {
  ROUTE_SPECS,
  ownerLikeCreds,
  requireCreds,
  login,
  openTabInApp,
  attachJson,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

async function diag(page) {
  return page.evaluate(() => {
    const d = window.__chaosFirestoreDiagnostics || {};
    const listeners = d.listeners && typeof d.listeners === 'object' ? d.listeners : {};
    return {
      activeListeners: Number(d.activeListeners || 0),
      activeDocuments: Number(d.activeDocuments || 0),
      listenerReuseCount: Number(d.listenerReuseCount || 0),
      listenerReleaseCount: Number(d.listenerReleaseCount || 0),
      writesInitiated: Number(d.writesInitiated || 0),
      writesCompleted: Number(d.writesCompleted || 0),
      skippedNoOpWrites: Number(d.skippedNoOpWrites || 0),
      listenerKeys: Object.keys(listeners).sort(),
      listeners: Object.fromEntries(Object.entries(listeners).map(([key, row]) => [key, {
        collection: row.collection || '',
        restaurantId: row.restaurantId || '',
        subscriberCount: Number(row.subscriberCount || 0),
        listenerCreationCount: Number(row.listenerCreationCount || 0),
        listenerReuseCount: Number(row.listenerReuseCount || 0),
        documentsReceivedInitial: Number(row.documentsReceivedInitial || 0),
        documentsReceivedChanges: Number(row.documentsReceivedChanges || 0),
        reconnectCount: Number(row.reconnectCount || 0),
      }]))
    };
  });
}

function diffDiagnostics(first, second) {
  const firstKeys = new Set(first.listenerKeys || []);
  const secondKeys = new Set(second.listenerKeys || []);
  const duplicateCreated = [];
  for (const key of secondKeys) {
    const a = first.listeners?.[key] || {};
    const b = second.listeners?.[key] || {};
    if (firstKeys.has(key) && Number(b.listenerCreationCount || 0) > Number(a.listenerCreationCount || 0)) {
      duplicateCreated.push({ key, before: a, after: b });
    }
  }
  return {
    newKeys: [...secondKeys].filter(k => !firstKeys.has(k)),
    duplicateCreated,
    writeDelta: Number(second.writesInitiated || 0) - Number(first.writesInitiated || 0),
    completedWriteDelta: Number(second.writesCompleted || 0) - Number(first.writesCompleted || 0),
    activeDelta: Number(second.activeListeners || 0) - Number(first.activeListeners || 0),
  };
}

test.describe('20 Firebase read/write and idempotency release gate', () => {
  test('opening and reopening unchanged routes does not create write storms or duplicate listener churn', async ({ page }, testInfo) => {
    test.setTimeout(18 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    await page.evaluate(() => { if (typeof window.resetFirebaseUsageDiagnostics === 'function') window.resetFirebaseUsageDiagnostics(); else window.__chaosFirestoreDiagnostics = null; }).catch(() => {});

    const perRoute = [];
    for (const route of ROUTE_SPECS) {
      await openTabInApp(page, route.tab, { settleMs: 1100 });
      await page.waitForFunction(() => !!window.__chaosFirestoreDiagnostics, null, { timeout: 8000 }).catch(() => {});
      const first = await diag(page);
      await openTabInApp(page, route.tab, { settleMs: 700 });
      const second = await diag(page);
      perRoute.push({ route: route.tab, first, second, diff: diffDiagnostics(first, second) });
    }

    const writeStorms = perRoute.filter(x => x.diff.writeDelta > 0 || x.diff.completedWriteDelta > 0).map(x => ({ route: x.route, diff: x.diff }));
    const duplicateListenerChurn = perRoute.filter(x => x.diff.duplicateCreated.length > 0).map(x => ({ route: x.route, duplicateCreated: x.diff.duplicateCreated }));
    const rapidReconnectLoop = perRoute.filter(x => Object.values(x.second.listeners || {}).some(row => Number(row.reconnectCount || 0) > 2)).map(x => ({ route: x.route }));

    await attachJson(testInfo, '20-firebase-cost-idempotency.json', { perRoute, writeStorms, duplicateListenerChurn, rapidReconnectLoop });
    expect(writeStorms, 'Reopening an unchanged route should perform zero business writes').toEqual([]);
    expect(duplicateListenerChurn, 'Reopening an unchanged route should not create another network listener for an identical canonical query key').toEqual([]);
    expect(rapidReconnectLoop, 'No route should enter a rapid Firestore reconnect loop').toEqual([]);
  });
});
