// 86 Chaos Production Deep Deep Deep Suite
// 06: API/network smoke contracts. 401/403/405 are allowed; 5xx is not.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  BASE_URL,
  ownerLikeCreds,
  requireCreds,
  watchForProblems,
  login,
  expectVersion,
  gotoTab,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

const API_ENDPOINTS = [
  '/api/whoami',
  '/api/health-checks',
  '/api/ai-usage',
  '/api/security-diagnostics',
  '/api/account-security',
  '/api/admin-access',
  '/api/presence-snapshot',
  '/api/presence-workspace-summary',
  '/api/full-system-diagnostics',
  '/api/quickbooks-sync-health',
  '/api/quickbooks-webhook-status',
  '/api/storage-doctor',
  '/api/schema-doctor',
  '/api/backup-preview',
  '/api/list-backups',
  '/api/report-bug',
  '/api/alerts',
  '/api/voice-command',
  '/api/scan-invoice',
  '/api/scan-menu',
  '/api/dispatch-reminders',
];

function endpointUrl(path) {
  return `${BASE_URL}${path}`;
}

test.describe('86 Chaos production readiness: API and network smoke', () => {
  test('critical API routes do not return 5xx to safe unauthenticated smoke requests', async ({ request }, testInfo) => {
    const results = [];
    for (const endpoint of API_ENDPOINTS) {
      const url = endpointUrl(endpoint);
      let result;
      try {
        const response = await request.get(url, { timeout: 15000, failOnStatusCode: false });
        result = { endpoint, status: response.status(), ok: response.ok(), allowed: response.status() < 500 };
      } catch (error) {
        result = { endpoint, status: 'request-error', message: error.message, allowed: false };
      }
      results.push(result);
    }

    await attachReport(testInfo, '06-api-smoke-results.json', { runId: RUN_ID, baseUrl: BASE_URL, results });
    const failures = results.filter((r) => !r.allowed);
    expect(failures, 'API smoke allows auth/method denials, but no 5xx/request crashes').toEqual([]);
  });

  test('route navigation does not create unexpected failed app requests', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(test, account, 'owner-like account');
    const problems = [];
    const requestFailures = [];
    watchForProblems(page, problems);
    page.on('requestfailed', (request) => {
      const url = request.url();
      const failure = request.failure()?.errorText || '';
      if (/favicon|\.well-known\/vercel\/jwe|sockjs|hot-update|ERR_ABORTED/i.test(`${url} ${failure}`)) return;
      requestFailures.push({ method: request.method(), url, failure });
    });

    await login(page, account.email, account.password);
    await expectVersion(page);
    for (const tab of ['today', 'published', 'schedule', 'financials', 'inventory', 'team', 'settings', 'godmode']) {
      await gotoTab(page, tab, { routeReadyTimeout: 50000, settleMs: 800 });
    }

    await attachReport(testInfo, '06-navigation-network-results.json', {
      runId: RUN_ID,
      baseUrl: BASE_URL,
      requestFailures,
      problems: summarizeProblems(problems),
    });

    expect(problems, 'Navigation should not create page errors, console TypeErrors, or HTTP 5xx responses').toEqual([]);
    expect(requestFailures, 'Navigation should not create unexpected requestfailed events').toEqual([]);
  });
});
