const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('Play Store security regression: native backup watchdog fails closed and stays time-bounded', async ({ request }, testInfo) => {
  const root = process.cwd();
  const source = fs.readFileSync(path.join(root, 'api/firestore-backup-watchdog.js'), 'utf8');
  const universe = fs.readFileSync(path.join(root, 'scripts/86chaos-release-gate/release-test-universe.cjs'), 'utf8');
  const releaseSpecPath = path.join(root, 'tests/86chaos-release-gate/37-native-backup-watchdog-hardening.spec.cjs');
  expect(source).toMatch(/DEFAULT_ADMIN_API_TIMEOUT_MS\s*=\s*8000/);
  expect(source).toMatch(/BACKUP_WATCHDOG_ADMIN_API_TIMEOUT_MS/);
  expect(source).toMatch(/DEFAULT_ADMIN_API_MAX_PAGES\s*=\s*10/);
  expect(source).toMatch(/BACKUP_WATCHDOG_ADMIN_API_MAX_PAGES/);
  expect(source).toMatch(/nativeBackupVerificationState:\s*isPermissionDenied\s*\?\s*'blocked_by_iam'\s*:\s*isTimeout\s*\?\s*'timed_out'/);
  expect(fs.existsSync(releaseSpecPath)).toBe(true);
  expect(universe).toContain('tests/86chaos-release-gate/37-native-backup-watchdog-hardening.spec.cjs');

  const response = await request.get('/api/firestore-backup-watchdog', {
    failOnStatusCode: false,
  });
  const body = await response.text();
  await testInfo.attach('06-native-backup-watchdog-play-store.json', {
    body: JSON.stringify({ project: testInfo.project.name, status: response.status(), body: body.slice(0, 1000) }, null, 2),
    contentType: 'application/json',
  });

  expect(response.status()).toBeGreaterThanOrEqual(400);
  expect(response.status()).toBeLessThan(500);
  expect(body).not.toMatch(/private[_ -]?key|access[_ -]?token|refresh[_ -]?token|Bearer\s+[A-Za-z0-9._-]{16,}/i);
});
