const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

function read(rel) {
  const p = path.join(process.cwd(), rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

test.describe('19 crash report, push, email, and delivery evidence contract', () => {
  test('automatic crash reporting preserves diagnostics and implements independent push plus email delivery', async ({}, testInfo) => {
    const reportBug = read('api/report-bug.js');
    const app = read('src/App.js');
    const core = read('src/core/appCore.js');
    const management = read('src/features/management.jsx');
    const sw = read('public/firebase-messaging-sw.js');
    const emailHelper = read('api/_support-email.js');

    const checks = {
      crashCategory: /Crash\s*\/\s*Error|ChunkLoadError|automatic crash/i.test(reportBug),
      unhandledRejection: /unhandledrejection/i.test(core + app),
      chunkRecovery: /ChunkLoadError|Loading chunk|dynamic import|update required|refresh app/i.test(core + app),
      dedupeFingerprint: /fingerprint|dedup/i.test(core + app + reportBug),
      emailHelperExists: Boolean(emailHelper),
      serverOnlyEmailEnv: /BUG_REPORT_EMAIL_API_KEY/.test(emailHelper + reportBug) && !/REACT_APP_BUG_REPORT_EMAIL_API_KEY/.test(emailHelper + reportBug),
      pushAttempt: /sendEachForMulticast|sendMulticast|messaging\(\).*send/i.test(reportBug),
      independentOutcomes: /email.*attempt|push.*attempt|Promise\.allSettled|allSettled/i.test(reportBug + emailHelper),
      fcmAcceptedNotDelivered: /accepted by fcm|delivery unconfirmed|received|opened/i.test(management),
      receiptTracking: /receivedAt|openedAt|deliveryReceipt|notificationReceipt/i.test(reportBug + management + sw),
      notificationClick: /notificationclick/i.test(sw),
      reportIdInPayload: /reportId/i.test(reportBug + sw),
    };

    const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    await attachJson(testInfo, '19-crash-notification-contract.json', { checks, failures });
    expect(failures, 'Crash reporting is not release-ready until report save, push acceptance, actual device receipt/open, and independent email delivery are represented').toEqual([]);
  });

  test('the bug ledger never labels FCM acceptance as proven delivery', async ({}, testInfo) => {
    const management = read('src/features/management.jsx');
    const misleading = [];
    const patterns = [
      /super admin push[^\n]{0,80}\bsent\b/i,
      /successCount[^\n]{0,120}(?:delivered|received)/i,
      /push[^\n]{0,40}delivered[^\n]{0,80}successCount/i,
    ];
    for (const re of patterns) if (re.test(management)) misleading.push(String(re));
    await attachJson(testInfo, '19-push-wording.json', { misleading });
    expect(misleading, 'FCM successCount means accepted by FCM, not delivered to a device').toEqual([]);
  });
});
