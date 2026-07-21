// 86 Chaos Reminders + Push Dispatch Deep Test
const { test, expect, request } = require('@playwright/test');
const {
  APP_URL,
  RUN_ID,
  ownerLikeCreds,
  watchForProblems,
  login,
  gotoTab,
  bodyText,
  assertNoUnavailablePage,
  expectAnyText,
  clickButtonIfPresent,
  fillFirstVisible,
  saveCurrentForm,
  hardStopIfProduction,
  attachReport,
} = require('./utils/chaos-helpers');

test.describe('86 Chaos Reminders + Push Dispatch Deep Test', () => {
  test.beforeAll(async () => { await hardStopIfProduction(); });

  test('personal reminders UI, dispatch endpoint preflight, and push admin surface', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const problems = [];
    const report = { runId: RUN_ID, actions: [], fields: [], api: [] };
    watchForProblems(page, problems, { acceptDialogs: true });

    const account = ownerLikeCreds();
    await login(page, account.email, account.password);

    await gotoTab(page, 'reminders');
    await assertNoUnavailablePage(page, problems, 'Reminders');
    await expectAnyText(page, [/Reminder|Personal|Shared|Due|Notify|Date|Time/i], problems, 'Reminders text');

    await fillFirstVisible(page, [/reminder|what|task|note|description/i], `Playwright reminder ${RUN_ID}`, report.fields, 'Reminder text').catch(() => {});
    await fillFirstVisible(page, [/date/i], new Date(Date.now() + 86400000).toISOString().slice(0, 10), report.fields, 'Reminder date').catch(() => {});
    await fillFirstVisible(page, [/time/i], '15:00', report.fields, 'Reminder time').catch(() => {});
    await saveCurrentForm(page, report.actions, 'Create personal reminder').catch((error) => {
      report.actions.push({ action: 'create-reminder-failed', error: error.message });
    });

    if (process.env.CRON_SECRET) {
      const api = await request.newContext({ baseURL: APP_URL });
      const res = await api.get('/api/dispatch-reminders', { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }).catch((error) => ({ error }));
      if (res.error) {
        report.api.push({ endpoint: '/api/dispatch-reminders', error: res.error.message });
      } else {
        report.api.push({ endpoint: '/api/dispatch-reminders', status: res.status(), bodyStart: await res.text().then((t) => t.slice(0, 500)).catch(() => '') });
        if (res.status() >= 500) problems.push({ type: 'dispatch-reminders-500', status: res.status() });
      }
      await api.dispose().catch(() => {});
    } else {
      report.api.push({ endpoint: '/api/dispatch-reminders', skipped: 'CRON_SECRET not set' });
    }

    await gotoTab(page, 'godmode').catch(() => {});
    const godText = await bodyText(page);
    if (/Push Notification|Push Control|Reminder|Token|Dispatch|Python Automation/i.test(godText)) {
      report.actions.push({ action: 'godmode-push-surface-visible', textStart: godText.slice(0, 800) });
      await clickButtonIfPresent(page, /Push|Notification|Reminder|Dispatch/i, report.actions, 'Open push/reminder admin surface', { exact: false }).catch(() => {});
    } else {
      report.actions.push({ action: 'godmode-push-surface-not-visible-or-not-authorized' });
    }

    await attachReport(testInfo, 'reminders-push-dispatch-report.json', { report, problems });
    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });
});
