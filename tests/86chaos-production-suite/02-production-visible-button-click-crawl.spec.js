// 86 Chaos Production Deep Deep Deep Suite
// 02: Visible button crawl. Safe by default, mutation/destructive clicks are opt-in.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  BASE_URL,
  TAB_LABELS,
  ownerLikeCreds,
  requireCreds,
  isMutationAllowed,
  watchForProblems,
  login,
  expectVersion,
  expectRouteHealthy,
  bodyText,
  closeTransientUi,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

const TABS_TO_CRAWL = [
  'today', 'published', 'schedule', 'financials', 'back-office', 'inventory', 'menu-intelligence',
  'ai-tools', 'prep', 'recipes', 'messages', 'reminders', 'team', 'maintenance', 'hr-training',
  'settings', 'help', 'audit', 'godmode',
];

const LIMIT_PER_TAB = Math.max(5, Number(process.env.CHAOS_BUTTON_CLICK_LIMIT_PER_TAB || 80));
const ALLOW_DESTRUCTIVE = /^(1|true|yes)$/i.test(process.env.CHAOS_ALLOW_DESTRUCTIVE || '');

const dangerousRe = /delete|remove|trash|archive|purge|reset|wipe|restore|backup now|force logout|log out everyone|logout everyone|send\b|submit\b|publish\b|approve|deny|reject|cancel request|clock in|clock out|save\b|create\b|add\b|import\b|upload\b|scan\b|connect quickbooks|disconnect|post to quickbooks|bill draft|run python|run automation|repair|mfa|recovery|deploy|tenant|email|push|notify|mark resolved|mark done|complete/i;
const safeInteractiveRe = /view|open|show|hide|next|back|previous|close|skip|filter|all|week|month|today|settings|help|search|clear|details|expand|collapse|my schedule|full schedule|request off|availability|schedule builder|trade board|templates|coverage|needs review|upcoming approved|published\/archived|history|preview/i;
const fatalRe = /Application error|Unhandled Runtime Error|Cannot read properties of undefined|Minified React error|Something went wrong|NaN|Infinity/i;

async function dismissBlockingModals(page) {
  for (const name of [/close employee quick start/i, /skip for now/i, /close/i, /cancel/i]) {
    const btn = page.getByRole('button', { name }).first();
    if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
      await btn.click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(250);
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
}

async function collectButtons(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const labelOf = (el) => (el.getAttribute('aria-label') || el.innerText || el.textContent || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 160);
    return Array.from(document.querySelectorAll('button')).map((el, index) => {
      const rect = el.getBoundingClientRect();
      return {
        index,
        label: labelOf(el),
        disabled: Boolean(el.disabled),
        visible: visible(el),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
      };
    }).filter((b) => b.visible);
  });
}

function shouldSkipButton(button) {
  const label = button.label || '(unlabeled)';
  if (button.disabled) return { skip: true, reason: 'disabled' };
  if (dangerousRe.test(label) && !(isMutationAllowed() && ALLOW_DESTRUCTIVE)) return { skip: true, reason: 'write/destructive requires CHAOS_ALLOW_MUTATION=1 and CHAOS_ALLOW_DESTRUCTIVE=1' };
  if (!label && !(isMutationAllowed() && ALLOW_DESTRUCTIVE)) return { skip: true, reason: 'unlabeled button skipped in safe mode' };
  if (!safeInteractiveRe.test(label) && dangerousRe.test(label)) return { skip: true, reason: 'not safe by label' };
  return { skip: false, reason: 'safe' };
}

test.describe('86 Chaos production readiness: visible button click crawl', () => {
  test.beforeEach(async ({ page }) => {
    const account = ownerLikeCreds();
    requireCreds(test, account, 'owner-like account');
    await login(page, account.email, account.password);
    await expectVersion(page);
  });

  for (const tab of TABS_TO_CRAWL) {
    test(`button crawl: ${tab}`, async ({ page }, testInfo) => {
      const problems = [];
      watchForProblems(page, problems);
      await expectRouteHealthy(page, tab, { allowGate: true, expected: TAB_LABELS[tab], routeReadyTimeout: 55000, settleMs: 1000 });
      await dismissBlockingModals(page);

      const initialButtons = await collectButtons(page);
      const clicked = [];
      const skipped = [];
      const clickErrors = [];

      for (const button of initialButtons.slice(0, LIMIT_PER_TAB)) {
        const decision = shouldSkipButton(button);
        if (decision.skip) {
          skipped.push({ ...button, reason: decision.reason });
          continue;
        }

        const beforeUrl = page.url();
        const locator = page.locator('button').nth(button.index);
        const stillVisible = await locator.isVisible({ timeout: 700 }).catch(() => false);
        const stillEnabled = await locator.isEnabled({ timeout: 700 }).catch(() => false);
        if (!stillVisible || !stillEnabled) {
          skipped.push({ ...button, reason: 'button moved/hidden/disabled after earlier click' });
          continue;
        }

        try {
          await locator.click({ timeout: 5000 });
          await page.waitForTimeout(550);
          await dismissBlockingModals(page);
          const text = await bodyText(page, 12000);
          expect(text, `${tab} after clicking ${button.label || button.index} should not show fatal UI`).not.toMatch(fatalRe);
          clicked.push({ ...button, beforeUrl, afterUrl: page.url() });
        } catch (error) {
          clickErrors.push({ ...button, message: error.message, beforeUrl, afterUrl: page.url() });
          await closeTransientUi(page);
        }
      }

      await attachReport(testInfo, `02-button-crawl-${tab}.json`, {
        runId: RUN_ID,
        baseUrl: BASE_URL,
        tab,
        limit: LIMIT_PER_TAB,
        mutationAllowed: isMutationAllowed(),
        destructiveAllowed: ALLOW_DESTRUCTIVE,
        initialButtonCount: initialButtons.length,
        clicked,
        skipped,
        clickErrors,
        problems: summarizeProblems(problems),
      });

      expect(clickErrors, `${tab} should not have safe visible button click failures`).toEqual([]);
      expect(problems, `${tab} safe button crawl should not create page errors, console TypeErrors, or HTTP 5xx responses`).toEqual([]);
    });
  }
});
