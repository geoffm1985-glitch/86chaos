const { test, expect } = require('@playwright/test');
const {
  creds,
  login,
  attachJson,
  bodyText,
  gotoTab,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

function requiredSystemAdmin() {
  const account = creds('SYSTEM_ADMIN');
  if (!account.email || !account.password) throw new Error('SYSTEM_ADMIN_EMAIL/SYSTEM_ADMIN_PASSWORD are required for the live crash-pipeline test.');
  return account;
}

test.describe('24 real browser-to-API crash report pipeline', () => {
  test('an unhandled client rejection creates one durable automatic report and exposes independent notification evidence', async ({ page }, testInfo) => {
    test.setTimeout(8 * 60 * 1000);
    const account = requiredSystemAdmin();
    await login(page, account.email, account.password, { tab: 'today' });
    const marker = `RELEASE_GATE_SYNTHETIC_CRASH_${Date.now()}`;
    const reportRequests = [];
    const reportResponses = [];
    page.on('request', request => {
      if (/\/api\/report-bug(?:\?|$)/.test(request.url())) reportRequests.push({ method: request.method(), url: request.url(), postData: String(request.postData() || '').slice(0, 12000) });
    });
    page.on('response', async response => {
      if (!/\/api\/report-bug(?:\?|$)/.test(response.url())) return;
      reportResponses.push({ status: response.status(), url: response.url(), body: (await response.text().catch(() => '')).slice(0, 12000) });
    });

    await page.evaluate((message) => {
      setTimeout(() => {
        const error = new Error(message);
        error.name = 'ReleaseGateSyntheticError';
        Promise.reject(error);
      }, 0);
    }, marker);

    await page.waitForTimeout(7000);
    expect(reportRequests.length, 'Global unhandled-rejection reporting must call /api/report-bug exactly once or be deduplicated to one request').toBe(1);
    expect(reportResponses.length, 'The crash report API must answer the browser request').toBe(1);
    expect(reportResponses[0].status, 'The crash report API must not fail').toBeGreaterThanOrEqual(200);
    expect(reportResponses[0].status, 'The crash report API must not fail').toBeLessThan(300);

    let parsed = null;
    try { parsed = JSON.parse(reportResponses[0].body); } catch (_) {}
    expect(parsed, 'The crash report endpoint must return JSON').toBeTruthy();
    expect(parsed.reportId || parsed.id, 'The response must include the durable report ID').toBeTruthy();

    const ledger = await gotoTab(page, 'godmode', { settleMs: 1800, maxText: 60000 });
    const notificationEvidence = {
      email: parsed.email || parsed.notifications?.email || parsed.delivery?.email || null,
      push: parsed.push || parsed.notifications?.push || parsed.delivery?.push || null,
    };
    await attachJson(testInfo, '24-live-crash-pipeline.json', { marker, reportRequests, reportResponses, parsed, notificationEvidence, ledgerSample: ledger.slice(0, 10000) });

    expect(JSON.stringify(parsed), 'Crash response must distinguish push and email outcomes').toMatch(/push/i);
    expect(JSON.stringify(parsed), 'Crash response must distinguish push and email outcomes').toMatch(/email/i);
    expect(JSON.stringify(parsed), 'FCM acceptance must not be represented as proven delivery').not.toMatch(/"delivered"\s*:\s*true[^}]{0,300}"successCount"/i);
    expect(`${ledger}\n${JSON.stringify(parsed)}`, 'The report must preserve the synthetic automatic error marker or report evidence').toContain(marker);
  });
});
