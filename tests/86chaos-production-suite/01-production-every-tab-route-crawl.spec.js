// 86 Chaos Production Deep Deep Deep Suite
// 01: Route crawl for every known top-level app surface.
const { test, expect } = require('@playwright/test');
const {
  RUN_ID,
  BASE_URL,
  TAB_LABELS,
  INTERNAL_ADMIN_DEBUG_RE,
  ownerLikeCreds,
  requireCreds,
  watchForProblems,
  login,
  expectVersion,
  expectRouteHealthy,
  bodyText,
  attachReport,
  summarizeProblems,
} = require('./utils/chaos-helpers');

const CORE_TABS = [
  'today',
  'published',
  'schedule',
  'financials',
  'back-office',
  'inventory',
  'menu-intelligence',
  'ai-tools',
  'prep',
  'recipes',
  'messages',
  'reminders',
  'team',
  'maintenance',
  'hr-training',
  'settings',
  'help',
  'audit',
  'godmode',
];

const fatalOrBrokenRe = /Application error|Unhandled Runtime Error|Cannot read properties of undefined|Minified React error|Something went wrong|NaN|Infinity|undefined undefined|null null/i;

async function collectUiInventory(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const label = (el) => (el.getAttribute('aria-label') || el.innerText || el.textContent || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 140);
    return {
      url: location.href,
      title: document.title,
      buttons: Array.from(document.querySelectorAll('button')).filter(visible).map((el, index) => ({ index, label: label(el), disabled: el.disabled, rect: el.getBoundingClientRect().toJSON?.() || {} })),
      links: Array.from(document.querySelectorAll('a[href]')).filter(visible).map((el, index) => ({ index, label: label(el), href: el.getAttribute('href') })),
      inputs: Array.from(document.querySelectorAll('input, textarea, select')).filter(visible).map((el, index) => ({ index, type: el.getAttribute('type') || el.tagName.toLowerCase(), label: label(el) || el.getAttribute('placeholder') || el.name || el.id || '', disabled: el.disabled })),
      headings: Array.from(document.querySelectorAll('h1,h2,h3,h4')).filter(visible).map((el) => label(el)),
      bodyStart: (document.body?.innerText || '').slice(0, 2500),
    };
  });
}

test.describe('86 Chaos production readiness: every route/tab renders', () => {
  test.beforeEach(async ({ page }) => {
    const account = ownerLikeCreds();
    requireCreds(test, account, 'owner-like account');
    await login(page, account.email, account.password);
    await expectVersion(page);
  });

  for (const tab of CORE_TABS) {
    test(`owner route health: ${tab}`, async ({ page }, testInfo) => {
      const problems = [];
      watchForProblems(page, problems);

      const route = await expectRouteHealthy(page, tab, {
        allowGate: true,
        expected: TAB_LABELS[tab],
        routeReadyTimeout: 55000,
        settleMs: 900,
      });
      const text = await bodyText(page, 18000);
      const inventory = await collectUiInventory(page);

      expect(text, `${tab} should not show fatal/broken calculated output`).not.toMatch(fatalOrBrokenRe);
      if (tab !== 'godmode') {
        expect(text, `${tab} should not leak internal admin diagnostic environment text`).not.toMatch(INTERNAL_ADMIN_DEBUG_RE);
      }

      await attachReport(testInfo, `01-route-${tab}.json`, {
        runId: RUN_ID,
        baseUrl: BASE_URL,
        tab,
        route,
        problems: summarizeProblems(problems),
        inventory,
      });

      expect(problems, `${tab} should not create page errors, console TypeErrors, or HTTP 5xx responses`).toEqual([]);
    });
  }
});
