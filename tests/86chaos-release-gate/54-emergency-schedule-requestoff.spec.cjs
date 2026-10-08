const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, bodyText, attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('54 emergency Schedule + Request Off regression coverage', () => {
  test('Schedule Builder keeps day/date headers sticky and horizontally aligned while scrolling', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    await gotoTab(page, 'schedule', { settleMs: 1400, maxText: 50000 });

    const sticky = page.getByTestId('schedule-builder-sticky-day-header').first();
    const headerScroll = page.getByTestId('schedule-builder-header-scroll').first();
    const bodyScroll = page.getByTestId('schedule-builder-body-scroll').first();
    await expect(sticky, 'Schedule Builder must render the persistent day/date header').toBeVisible({ timeout: 15000 });
    await expect(bodyScroll, 'Schedule Builder body scroller must be present').toBeVisible({ timeout: 15000 });

    const position = await sticky.evaluate(el => getComputedStyle(el).position);
    const stickyTop = await sticky.evaluate(el => parseFloat(getComputedStyle(el).top || '0'));
    expect(position, 'Day/date header must use CSS sticky positioning').toBe('sticky');

    const horizontal = await bodyScroll.evaluate(el => {
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      const target = Math.min(max, Math.max(0, Math.round(max * 0.45)));
      el.scrollLeft = target;
      el.dispatchEvent(new Event('scroll', { bubbles: true }));
      return { max, target, body: el.scrollLeft };
    });
    if (horizontal.max > 5) {
      await expect.poll(async () => headerScroll.evaluate(el => el.scrollLeft), { timeout: 5000 }).toBeCloseTo(horizontal.body, 0);
    }

    const vertical = await sticky.evaluate(el => {
      const top = parseFloat(getComputedStyle(el).top || '0');
      const rect = el.getBoundingClientRect();
      let parent = el.parentElement;
      while (parent) {
        const style = getComputedStyle(parent);
        const scrollable = /(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 8;
        if (scrollable) break;
        parent = parent.parentElement;
      }
      const scrollportTop = parent ? parent.getBoundingClientRect().top : 0;
      const beforeScrollTop = parent ? parent.scrollTop : window.scrollY;
      const amount = Math.max(240, rect.top - (scrollportTop + top) + 260);
      if (parent) parent.scrollTop = Math.min(parent.scrollHeight - parent.clientHeight, parent.scrollTop + amount);
      else window.scrollBy(0, amount);
      return { top, initialTop: rect.top, scrollportTop, beforeScrollTop, usedElementScroller: !!parent };
    });
    await page.waitForTimeout(300);
    const after = await sticky.evaluate((el, before) => {
      let parent = el.parentElement;
      while (parent) {
        const style = getComputedStyle(parent);
        const scrollable = /(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 8;
        if (scrollable) break;
        parent = parent.parentElement;
      }
      const afterScrollTop = parent ? parent.scrollTop : window.scrollY;
      const scrollDelta = Math.max(0, afterScrollTop - before.beforeScrollTop);
      const pinnedViewportTop = before.scrollportTop + before.top;
      return {
        afterTop: el.getBoundingClientRect().top,
        afterScrollTop,
        scrollDelta,
        pinnedViewportTop,
        expectedTop: Math.max(pinnedViewportTop, before.initialTop - scrollDelta),
      };
    }, vertical);
    const afterTop = after.afterTop;
    expect(afterTop, 'After vertical scrolling, the day/date header must follow sticky geometry within its nested scrollport').toBeGreaterThanOrEqual(after.expectedTop - 4);
    expect(afterTop, 'After vertical scrolling, the day/date header must follow sticky geometry within its nested scrollport').toBeLessThanOrEqual(after.expectedTop + 8);

    const dates = await page.getByTestId('schedule-builder-day-header-cell').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-date')).filter(Boolean));
    expect(dates.length, 'Sticky header should expose the visible schedule day columns').toBeGreaterThanOrEqual(7);
    await attachJson(testInfo, '54-sticky-schedule-header.json', { project: testInfo.project.name, position, stickyTop, afterTop, horizontal, vertical: { ...vertical, ...after }, dates: dates.slice(0, 40) });
  });

  test('Request Off partial-time UI blocks backwards ranges before a write can be attempted', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    await gotoTab(page, 'schedule', { settleMs: 1000, maxText: 50000 });

    const requestOffTab = page.getByTestId('schedule-request-off-tab');
    await expect(requestOffTab, 'Request Off must be reachable from Time Clock & Schedule').toBeVisible({ timeout: 12000 });
    await requestOffTab.click();
    await page.waitForTimeout(700);

    const partialToggle = page.getByRole('checkbox', { name: /Only part of each day/i }).first();
    await expect(partialToggle).toBeVisible({ timeout: 10000 });
    await partialToggle.check();
    const start = page.getByTestId('request-off-partial-start');
    const end = page.getByTestId('request-off-partial-end');
    await start.fill('16:00');
    await end.fill('14:00');

    await expect(end, 'End time must inherit the current start as its minimum valid clock value').toHaveAttribute('min', '16:00');
    const nativeValidity = await end.evaluate(el => ({ valid: el.validity.valid, rangeUnderflow: el.validity.rangeUnderflow, min: el.min, value: el.value }));
    expect(nativeValidity.rangeUnderflow, 'A 4 PM -> 2 PM partial Request Off must be invalid at the browser input layer').toBe(true);
    const text = await bodyText(page, 40000);
    expect(text).not.toMatch(/FIRESTORE.*INTERNAL ASSERTION FAILED|INTERNAL ASSERTION FAILED.*Unexpected state/i);
    await attachJson(testInfo, '54-request-off-backwards-time.json', { nativeValidity, project: testInfo.project.name });
  });
});
