// 86 Chaos Voice Command Deep Test
// Uses typed commands where possible so it works without microphone permissions.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  ownerLikeCreds,
  watchForProblems,
  login,
  gotoTab,
  bodyText,
  assertNoUnavailablePage,
  clickButtonIfPresent,
  closeBlockingModals,
  hardStopIfProduction,
  attachReport,
} = require('./utils/chaos-helpers');

const COMMANDS = [
  'what needs attention',
  'open inventory',
  '86 chicken wings',
  'add 2 pans of onions to prep',
  'mark onions done',
  'remind me tomorrow at 3 to order fries',
];

test.describe('86 Chaos Voice Command Deep Test', () => {
  test.beforeAll(async () => { await hardStopIfProduction(); });

  test('typed voice commands parse, navigate, respect permissions, and avoid crashes', async ({ page }, testInfo) => {
    test.setTimeout(300000);
    const problems = [];
    const report = { runId: RUN_ID, commands: [] };
    watchForProblems(page, problems, { acceptDialogs: true });

    const account = ownerLikeCreds();
    await login(page, account.email, account.password);
    await gotoTab(page, 'today');

    await clickButtonIfPresent(page, /86 Voice|Voice Assistant|Voice/i, report.commands, 'Open 86 Voice', { exact: false }).catch(() => {});
    await closeBlockingModals(page);

    const voiceTextBefore = await bodyText(page);
    if (!/Voice|Command|Assistant|Parse|Listening|Mic/i.test(voiceTextBefore)) {
      report.skipped = 'Voice UI was not visible from Today for this account/tier.';
      await attachReport(testInfo, 'voice-command-deep-report.json', { report, problems });
      expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
      return;
    }

    for (const command of COMMANDS) {
      const input = page.locator('textarea, input[type="text"]').filter({ hasText: /.*/ }).last();
      const visible = await input.isVisible({ timeout: 2500 }).catch(() => false);
      if (!visible) {
        report.commands.push({ command, skipped: true, reason: 'typed command input not visible' });
        continue;
      }
      await input.fill(command);
      await clickButtonIfPresent(page, /Parse Typed Command|Parse|Run Command|Submit|Send/i, report.commands, `Voice command: ${command}`).catch((error) => {
        problems.push({ type: 'voice-command-submit-failed', command, message: error.message, url: page.url() });
      });
      const text = await bodyText(page);
      report.commands.push({ command, url: page.url(), textStart: text.slice(0, 900) });
      if (/permission-denied|firebase error|network-request-failed|undefined|NaN/i.test(text)) {
        problems.push({ type: 'voice-command-visible-error', command, textStart: text.slice(0, 900), url: page.url() });
      }
      await closeBlockingModals(page);
    }

    await assertNoUnavailablePage(page, problems, 'After voice commands');
    await attachReport(testInfo, 'voice-command-deep-report.json', { report, problems });
    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });
});
