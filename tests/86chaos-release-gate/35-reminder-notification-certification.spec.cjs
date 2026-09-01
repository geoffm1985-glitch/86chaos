const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
  ownerLikeCreds,
  requireCreds,
  login,
  gotoTab,
  attachJson,
  ALLOW_MUTATION,
  mutationSkipMessage,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

const read = rel => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

test.describe('35 reminder notification Play Store certification', () => {
  test('dispatcher is protected, indexed, canonical-profile aware, and Firebase-cost bounded', async ({ request }, testInfo) => {
    const base = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.BASE_URL;
    const dispatchSource = read('api/dispatch-reminders.js');
    const saveSource = read('api/personal-reminder-save.js');
    const appSource = read('src/App.js');
    const vercel = JSON.parse(read('vercel.json'));
    const cron = (vercel.crons || []).find(row => row.path === '/api/dispatch-reminders');

    const unauthorized = await request.get(new URL('/api/dispatch-reminders', base).toString(), {
      headers: { Authorization: `Bearer release-gate-invalid-${Date.now()}` },
      failOnStatusCode: false,
    });
    const unauthorizedBody = await unauthorized.json().catch(() => ({}));
    const unauthenticatedSave = await request.post(new URL('/api/personal-reminder-save', base).toString(), {
      data: {},
      failOnStatusCode: false,
    });

    const recipientResolver = dispatchSource.slice(
      dispatchSource.indexOf('async function resolvePersonalReminderRecipient'),
      dispatchSource.indexOf('function norm', dispatchSource.indexOf('async function resolvePersonalReminderRecipient'))
    );
    const checks = {
      fiveMinuteProductionCron: cron?.schedule === '*/5 * * * *',
      dueQueueIsIndexedAndLimited: /where\('dispatchEligible',\s*'==',\s*true\)[\s\S]*where\('nextDispatchAt',\s*'<=',\s*nowIso\)[\s\S]*orderBy\('nextDispatchAt',[\s\S]*limit\(limit\)/.test(dispatchSource),
      transactionClaimBeforeSend: /runTransaction[\s\S]*status:\s*'dispatching'[\s\S]*sendEachForMulticast/.test(dispatchSource),
      canonicalProfileFirst: /recipient\.recipientProfileId|reminder\.recipientProfileId/.test(dispatchSource) && /recipientProfileId/.test(saveSource),
      oneReadBudgetIsReported: /recipientReads/.test(dispatchSource) && /recipientFallbackReads/.test(dispatchSource),
      noRecipientCollectionQuery: !/collection\('users'\)\.where|collection\("users"\)\.where/.test(recipientResolver),
      explicitWebNotificationContent: /webPushOptions\(tag, '\/\?tab=reminders', title, body\)/.test(dispatchSource),
      foregroundSystemNotification: /showForegroundPushNotification\(payload\)/.test(appSource) && /registration\.showNotification\(title/.test(appSource),
      noForegroundFirebaseActivity: !/onSnapshot|getDoc|getDocs|addDoc|setDoc|updateDoc|secureFetch|setInterval/.test(appSource.slice(appSource.indexOf('const showForegroundPushNotification'), appSource.indexOf('const clearChunkRecoveryMarkers'))),
      selfSaveReusesCaller: /assigningToCaller[\s\S]*\? callerMembership/.test(saveSource),
      directWorkspaceEvidenceSkipsMembershipRead: /userHasWorkspace\(user, restaurantId\)\) return \{ ok: true, user, member: null \}/.test(saveSource),
    };
    const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    await attachJson(testInfo, '35-reminder-dispatch-contract.json', {
      checks,
      failures,
      unauthorized: { status: unauthorized.status(), body: unauthorizedBody },
      unauthenticatedSaveStatus: unauthenticatedSave.status(),
    });

    expect(unauthorized.status(), 'Wrong cron secret must be rejected before any Firestore access').toBe(401);
    expect(unauthorizedBody.ok).toBe(false);
    expect(unauthenticatedSave.status(), 'Reminder creation without a signed-in user must be rejected').toBe(401);
    expect(failures, 'Reminder delivery lost a required security, visibility, identity, or Firebase-cost invariant').toEqual([]);
  });

  test('Chromium can create and enumerate a real service-worker system notification', async ({ context, page }, testInfo) => {
    const base = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.BASE_URL;
    const origin = new URL(base).origin;
    await context.grantPermissions(['notifications'], { origin });
    await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const result = await page.evaluate(async () => {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker did not become ready')), 15_000)),
      ]);
      const tag = `86chaos-reminder-release-gate-${Date.now()}`;
      await registration.showNotification('86 Chaos Reminder Test', {
        body: 'Play Store notification display certification',
        icon: '/app-icon.png',
        badge: '/notification-badge.png',
        tag,
        data: { url: '/?tab=reminders', notificationTag: tag },
      });
      const notifications = await registration.getNotifications({ tag });
      const evidence = notifications.map(notification => ({
        title: notification.title,
        body: notification.body,
        tag: notification.tag,
        url: notification.data?.url || '',
      }));
      notifications.forEach(notification => notification.close());
      return {
        permission: Notification.permission,
        activeScript: registration.active?.scriptURL || '',
        evidence,
      };
    });
    await attachJson(testInfo, '35-system-notification-display.json', result);
    expect(result.permission).toBe('granted');
    expect(result.activeScript).toBeTruthy();
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]).toEqual(expect.objectContaining({
      title: '86 Chaos Reminder Test',
      body: 'Play Store notification display certification',
      url: '/?tab=reminders',
    }));
  });

  test('signed-in reminder save persists through the real API and can be cancelled cleanly', async ({ page }, testInfo) => {
    if (!ALLOW_MUTATION) test.skip(true, mutationSkipMessage());
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    await gotoTab(page, 'reminders', { settleMs: 1400, maxText: 30_000 });

    const uniqueTitle = `Play Store reminder ${Date.now()}`;
    const localInputs = await page.evaluate(() => {
      const date = new Date(Date.now() + 20 * 60 * 1000);
      const pad = value => String(value).padStart(2, '0');
      return {
        date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
      };
    });
    const form = page.locator('form').filter({ has: page.getByLabel('Reminder') }).first();
    await form.getByLabel('Reminder').fill(uniqueTitle);
    await form.getByLabel('Date').fill(localInputs.date);
    await form.getByLabel('Time').fill(localInputs.time);
    await form.getByLabel('Sharing').selectOption('self');

    const saveResponsePromise = page.waitForResponse(response => response.url().includes('/api/personal-reminder-save') && response.request().method() === 'POST', { timeout: 30_000 });
    await form.getByRole('button', { name: /^Add$/i }).click();
    const saveResponse = await saveResponsePromise;
    const saveBody = await saveResponse.json().catch(() => ({}));
    expect(saveResponse.status(), `Reminder save failed: ${JSON.stringify(saveBody).slice(0, 800)}`).toBe(200);
    expect(saveBody.ok).toBe(true);
    await expect(page.getByText(uniqueTitle, { exact: true })).toBeVisible({ timeout: 20_000 });

    const row = page.locator('.chaos-table-row').filter({ has: page.getByText(uniqueTitle, { exact: true }) }).filter({ has: page.locator('button svg.lucide-trash-2') }).first();
    const cancelResponsePromise = page.waitForResponse(response => response.url().includes('/api/personal-reminder-action') && response.request().method() === 'POST', { timeout: 30_000 });
    await row.locator('button').filter({ has: page.locator('svg.lucide-trash-2') }).click();
    const cancelResponse = await cancelResponsePromise;
    const cancelBody = await cancelResponse.json().catch(() => ({}));
    await attachJson(testInfo, '35-reminder-real-api-lifecycle.json', {
      uniqueTitle,
      save: { status: saveResponse.status(), body: saveBody },
      cancel: { status: cancelResponse.status(), body: cancelBody },
    });
    expect(cancelResponse.status(), `Reminder cleanup failed: ${JSON.stringify(cancelBody).slice(0, 800)}`).toBe(200);
    expect(cancelBody).toEqual(expect.objectContaining({ ok: true, action: 'cancel', status: 'cancelled' }));
  });
});
