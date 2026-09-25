const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const read = rel => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

test.describe('37 native backup watchdog hardening release gate', () => {
  test('watchdog has bounded credential, Admin API, and pagination work', async ({}, testInfo) => {
    const source = read('api/firestore-backup-watchdog.js');
    const checks = {
      credentialTimeout: /withTimeout\(credential\.getAccessToken\(\),\s*timeoutMs/.test(source),
      requestAbortController: /new AbortController\(\)/.test(source) && /signal:\s*controller\.signal/.test(source),
      timeoutCategory: /admin_api_timeout/.test(source),
      boundedPagination: /DEFAULT_ADMIN_API_MAX_PAGES\s*=\s*10/.test(source) && /pageCount\s*>=\s*maxPages/.test(source),
      paginationCategory: /admin_api_pagination_limit/.test(source),
      durationTelemetry: /lastWatchdogDurationMs/.test(source),
      timeoutTelemetry: /nativeBackupAdminApiTimeoutMs/.test(source),
      pageLimitTelemetry: /nativeBackupAdminApiMaxPages/.test(source),
    };
    await testInfo.attach('37-native-backup-watchdog-source-contract.json', {
      body: JSON.stringify(checks, null, 2),
      contentType: 'application/json',
    });
    expect(Object.entries(checks).filter(([, ok]) => !ok), 'Watchdog lost a bounded-work safety invariant').toEqual([]);
  });

  test('deployed watchdog remains protected and does not leak credentials on rejected requests', async ({ request }, testInfo) => {
    const response = await request.get('/api/firestore-backup-watchdog', {
      headers: { Authorization: `Bearer invalid-release-gate-${Date.now()}` },
      failOnStatusCode: false,
    });
    const text = await response.text();
    await testInfo.attach('37-native-backup-watchdog-auth-boundary.json', {
      body: JSON.stringify({ status: response.status(), body: text.slice(0, 1200) }, null, 2),
      contentType: 'application/json',
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
        expect(text).not.toMatch(/private[_ -]?key|access[_ -]?token|refresh[_ -]?token|authorization\s*[:=]\s*Bearer\s+[A-Za-z0-9._-]{16,}|credential\s*[:=]\s*[A-Za-z0-9_\-]{20,}/i);
  });
});
