const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, bodyText, attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('56 Manager Brief runtime + sticky Schedule Builder day header', () => {
  test('Manager Brief opens without the 17.0.40 runtime recovery crash', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    await gotoTab(page, 'today', { settleMs: 1800, maxText: 50000 });

    const text = await bodyText(page, 50000);
    expect(text).not.toMatch(/This section hit a snag/i);
    expect(text).not.toMatch(/Ve is not a function/i);
    expect(text).not.toMatch(/86 Chaos bug report: Crash \/ Error/i);
    await expect(page.getByTestId('restaurant-readiness-score').first(), 'Manager Brief readiness should render instead of recovery UI').toBeVisible({ timeout: 15000 });
    await attachJson(testInfo, '56-manager-brief-runtime.json', { project: testInfo.project.name, recoveryVisible: /This section hit a snag/i.test(text), minifiedFunctionCrash: /Ve is not a function/i.test(text) });
  });

  test('Schedule Builder day/date header stays pinned while compact control deck scrolls away', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    await gotoTab(page, 'schedule', { settleMs: 1400, maxText: 50000 });

    const deck = page.getByTestId('schedule-builder-control-deck').first();
    const sticky = page.getByTestId('schedule-builder-sticky-day-header').first();
    await expect(deck).toBeVisible({ timeout: 15000 });
    await expect(sticky).toBeVisible({ timeout: 15000 });

    const before = await page.evaluate(() => {
      const deck = document.querySelector('[data-testid="schedule-builder-control-deck"]');
      const sticky = document.querySelector('[data-testid="schedule-builder-sticky-day-header"]');
      const shell = document.querySelector('.desktop-pro-shell[data-active-tab="schedule"] .app-content-shell');
      return {
        viewport: { width: innerWidth, height: innerHeight },
        deck: deck?.getBoundingClientRect().toJSON?.() || null,
        sticky: sticky?.getBoundingClientRect().toJSON?.() || null,
        stickyTop: sticky ? parseFloat(getComputedStyle(sticky).top || '0') : null,
        deckPosition: deck ? getComputedStyle(deck).position : null,
        shellScrollable: !!shell && /(auto|scroll)/.test(getComputedStyle(shell).overflowY) && shell.scrollHeight > shell.clientHeight + 8,
      };
    });

    await page.evaluate(() => {
      const sticky = document.querySelector('[data-testid="schedule-builder-sticky-day-header"]');
      const amount = Math.max(700, (sticky?.getBoundingClientRect().top || 0) + 450);
      let scrollport = sticky?.parentElement || null;
      while (scrollport) {
        const style = getComputedStyle(scrollport);
        if (/(auto|scroll)/.test(style.overflowY) && scrollport.scrollHeight > scrollport.clientHeight + 8) break;
        scrollport = scrollport.parentElement;
      }
      if (scrollport) {
        scrollport.scrollTop = Math.min(scrollport.scrollHeight - scrollport.clientHeight, scrollport.scrollTop + amount);
        scrollport.dispatchEvent(new Event('scroll', { bubbles: true }));
      } else {
        window.scrollBy(0, amount);
      }
    });
    await page.waitForTimeout(350);

    const after = await page.evaluate(() => {
      const deck = document.querySelector('[data-testid="schedule-builder-control-deck"]');
      const sticky = document.querySelector('[data-testid="schedule-builder-sticky-day-header"]');
      const deckRect = deck?.getBoundingClientRect();
      const stickyRect = sticky?.getBoundingClientRect();
      let scrollport = sticky?.parentElement || null;
      while (scrollport) {
        const style = getComputedStyle(scrollport);
        if (/(auto|scroll)/.test(style.overflowY) && scrollport.scrollHeight > scrollport.clientHeight + 8) break;
        scrollport = scrollport.parentElement;
      }
      const scrollportRect = scrollport?.getBoundingClientRect();
      const computedStickyTop = sticky ? parseFloat(getComputedStyle(sticky).top || '0') : null;
      return {
        deckBottom: deckRect?.bottom ?? null,
        stickyTop: stickyRect?.top ?? null,
        computedStickyTop,
        stickyScrollportTop: scrollportRect?.top ?? 0,
        expectedStickyViewportTop: Number.isFinite(computedStickyTop) ? (scrollportRect?.top ?? 0) + computedStickyTop : null,
        usedElementScrollport: Boolean(scrollport),
        deckPosition: deck ? getComputedStyle(deck).position : null,
        visible: !!stickyRect && stickyRect.bottom > 0 && stickyRect.top < innerHeight,
      };
    });

    expect(after.visible, 'Day/date header must remain visible after scrolling deep into staff rows').toBe(true);
    if ((before.viewport?.width || 0) <= 1023) {
      expect(before.deckPosition, 'Compact/mobile control deck must scroll with content instead of consuming the viewport').not.toBe('sticky');
      expect(after.deckPosition).not.toBe('sticky');
      expect(after.stickyTop, 'Compact/mobile day/date header must pin to its nested scrollport plus computed sticky offset').toBeGreaterThanOrEqual((after.expectedStickyViewportTop ?? 0) - 4);
      expect(after.stickyTop, 'Compact/mobile day/date header must pin to its nested scrollport plus computed sticky offset').toBeLessThanOrEqual((after.expectedStickyViewportTop ?? 0) + 8);
    } else {
      expect(after.deckPosition, 'Desktop control deck remains sticky').toBe('sticky');
      expect(after.stickyTop, 'Desktop day/date header must remain below the sticky control deck').toBeGreaterThanOrEqual((after.deckBottom ?? 0) - 8);
    }
    const dates = await page.getByTestId('schedule-builder-day-header-cell').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-date')).filter(Boolean));
    expect(dates.length).toBeGreaterThanOrEqual(7);
    await attachJson(testInfo, '56-sticky-header-current-layout.json', { project: testInfo.project.name, before, after, dates: dates.slice(0, 40) });
  });
});
