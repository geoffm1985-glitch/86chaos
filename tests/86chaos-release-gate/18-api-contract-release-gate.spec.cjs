const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

const RISKY_POST = /quickbooks-webhook|dispatch-reminders|firestore-backup|watchdog|weekly-maintenance|send-push|send-schedule-alert|delete-user|delete-users-bulk|deploy-tenant|restore-drill|master-admin-repair|full-audit-qa-cleanup|import-cheers|account-deletion-request/i;
const LEAK_RE = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|serviceAccount|refreshToken|clientSecret|FIREBASE_SERVICE_ACCOUNT_KEY|AIza[0-9A-Za-z_-]{20,}/i;
const STACK_RE = /\bat\s+[A-Za-z0-9_$<>.]+\s*\([^\n]+:\d+:\d+\)|node_modules\//i;

function apiFiles() {
  const dir = path.join(process.cwd(), 'api');
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.js') && !name.startsWith('_'))
    .map(name => ({ name, endpoint: `/api/${name.replace(/\.js$/, '')}`, source: fs.readFileSync(path.join(dir, name), 'utf8') }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

test.describe('18 API contract and unauthenticated abuse gate', () => {
  test('every public API file rejects malformed unauthenticated calls cleanly without 5xx or secret leakage', async ({ request }, testInfo) => {
    test.setTimeout(20 * 60 * 1000);
    const base = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.BASE_URL;
    const results = [];
    for (const api of apiFiles()) {
      const url = new URL(api.endpoint, base).toString();
      for (const method of ['GET', ...(!RISKY_POST.test(api.name) ? ['POST'] : [])]) {
        const response = method === 'GET'
          ? await request.get(url, { failOnStatusCode: false, timeout: 45000 })
          : await request.post(url, { failOnStatusCode: false, timeout: 45000, data: {} });
        const text = (await response.text().catch(() => '')).slice(0, 12000);
        results.push({ endpoint: api.endpoint, method, status: response.status(), contentType: response.headers()['content-type'] || '', leakedSecret: LEAK_RE.test(text), leakedStack: STACK_RE.test(text), sample: text.slice(0, 1200) });
      }
    }

    const serverErrors = results.filter(r => r.status >= 500);
    const leaks = results.filter(r => r.leakedSecret || r.leakedStack);
    await attachJson(testInfo, '18-api-contract-results.json', { totals: { endpoints: apiFiles().length, calls: results.length, serverErrors: serverErrors.length, leaks: leaks.length }, serverErrors, leaks, results });
    expect(serverErrors, 'Malformed or unauthenticated requests must return controlled 4xx/405 responses, never unhandled 5xx').toEqual([]);
    expect(leaks, 'API error responses must not expose secrets or server stack traces').toEqual([]);
  });

  test('API source files have explicit method, authorization, body-size, and error handling markers', async ({}, testInfo) => {
    const findings = [];
    for (const api of apiFiles()) {
      const s = api.source;
      const hasMethod = /req\.method|request\.method/i.test(s);
      const hasAuth = /authorize\(|verifyIdToken|Authorization|requireAppCheck|webhook|cron_secret|CRON_SECRET/i.test(s);
      const hasError = /try\s*\{|catch\s*\(/.test(s);
      const hasBodyGuard = /readBody\(|content-length|body.*size|MAX_.*BODY|JSON\.parse/i.test(s);
      if (!hasMethod || !hasAuth || !hasError) findings.push({ endpoint: api.endpoint, hasMethod, hasAuth, hasError, hasBodyGuard });
    }
    await attachJson(testInfo, '18-api-source-contract.json', { findings });
    expect(findings, 'Every API endpoint needs explicit method handling, authorization/verified webhook handling, and controlled error handling').toEqual([]);
  });
});
