// 86 Chaos Mobile Layout Deep Test
// Checks important screens in phone/tablet/desktop viewports for overflow and unusable surfaces.
const { test, expect, devices } = require('@playwright/test');
const {
  RUN_ID,
  ownerLikeCreds,
  watchForProblems,
  login,
  gotoTab,
  bodyText,
  assertNoUnavailablePage,
  attachReport,
} = require('./utils/chaos-helpers');

const VIEWPORTS = [
  { name: 'Galaxy S24-ish', width: 412, height: 915, isMobile: true },
  { name: 'Small Android', width: 360, height: 800, isMobile: true },
  { name: 'iPhone 15-ish', width: 393, height: 852, isMobile: true },
  { name: 'Tablet', width: 768, height: 1024, isMobile: false },
  { name: 'Desktop', width: 1440, height: 900, isMobile: false },
];

const TABS = ['today', 'financials', 'back-office', 'schedule', 'published', 'inventory', 'team', 'settings', 'help'];

async function overflowInfo(page) {
  return await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const wide = Array.from(document.querySelectorAll('*')).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > window.innerWidth + 8 || rect.right > window.innerWidth + 8;
    }).slice(0, 10).map((el) => ({
      tag: el.tagName,
      text: (el.textContent || '').trim().slice(0, 90),
      className: String(el.className || '').slice(0, 120),
      width: Math.round(el.getBoundingClientRect().width),
      right: Math.round(el.getBoundingClientRect().right),
    }));
    return {
      innerWidth: window.innerWidth,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      hasHorizontalOverflow: Math.max(doc.scrollWidth, body.scrollWidth) > window.innerWidth + 8,
      offenders: wide,
    };
  });
}

test.describe('86 Chaos Mobile Layout Deep Test', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} important pages render without horizontal overflow`, async ({ browser }, testInfo) => {
      test.setTimeout(420000);
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile });
      const page = await context.newPage();
      const problems = [];
      const report = { runId: RUN_ID, viewport, pages: [] };
      watchForProblems(page, problems);

      const account = ownerLikeCreds();
      await login(page, account.email, account.password);

      for (const tab of TABS) {
        await gotoTab(page, tab).catch((error) => problems.push({ type: 'mobile-route-failed', viewport: viewport.name, tab, message: error.message, url: page.url() }));
        await assertNoUnavailablePage(page, problems, `${viewport.name} ${tab}`);
        const text = await bodyText(page);
        const overflow = await overflowInfo(page);
        report.pages.push({ tab, url: page.url(), textStart: text.slice(0, 350), overflow });
        if (overflow.hasHorizontalOverflow && viewport.width <= 768) {
          problems.push({ type: 'mobile-horizontal-overflow', viewport: viewport.name, tab, overflow });
        }
        if (/undefined|NaN/i.test(text)) {
          problems.push({ type: 'mobile-visible-bad-value', viewport: viewport.name, tab, textStart: text.slice(0, 900) });
        }
      }

      await testInfo.attach(`mobile-layout-${viewport.name.replace(/\W+/g, '-')}.json`, { body: JSON.stringify({ report, problems }, null, 2), contentType: 'application/json' });
      await context.close();
      expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
    });
  }
});
