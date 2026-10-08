'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const { scheduleGridFixture, scrollBindings } = require('../fixtures/schedule-builder-grid-fixture.cjs');
const root = path.resolve(__dirname, '../..');
const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
let utilities;
test.beforeAll(async () => {
  const source = fs.readFileSync(path.join(root, 'src/features/schedule.jsx'), 'utf8');
  const theme = fs.readFileSync(path.join(root, 'src/core/appCore.js'), 'utf8');
  utilities = (await postcss([tailwind({ content: [{ raw: `${source}\n${theme}`, extension: 'jsx' }], theme: { extend: {} }, plugins: [] })])
    .process('@tailwind base; @tailwind utilities;', { from: undefined })).css;
});

// Render the actual production grid JSX, colgroup, scroll callback, and CSS.
// The data is a layout fixture; this does not claim authenticated workflow coverage.
for (const width of [360, 412, 768, 1024, 1440]) {
  for (const events of [false, true]) {
    test(`date columns align throughout the month at ${width}px, events=${events}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 915 });
      await page.setContent(`<style>${utilities}\n${css}\nhtml,body{margin:0}</style><div class="desktop-pro-shell" data-active-tab="schedule"><main class="app-content-shell">${scheduleGridFixture({ events })}</main></div>`);
      await page.addScriptTag({ content: scrollBindings() });
      for (const source of ['body', 'header']) {
        for (const position of [0, 0.5, 0.85, 1]) {
          await page.getByTestId(`schedule-builder-${source}-scroll`).evaluate((element, position) => {
            element.scrollLeft = (element.scrollWidth - element.clientWidth) * position;
          }, position);
          await expect.poll(async () => page.evaluate(() => {
            const header = document.querySelector('[data-testid="schedule-builder-header-scroll"]');
            const body = document.querySelector('[data-testid="schedule-builder-body-scroll"]');
            return Math.abs(header.scrollLeft - body.scrollLeft);
          })).toBeLessThan(1);
          const alignment = await page.evaluate(() => {
            const headers = [...document.querySelectorAll('[data-testid="schedule-builder-day-header-cell"]')];
            return headers.map(header => {
              const date = header.dataset.date;
              const cell = document.querySelector(`[data-testid="schedule-builder-cell"][data-date="${date}"][data-employee-id="allen"]`);
              const a = header.getBoundingClientRect(), b = cell.getBoundingClientRect();
              return { date, leftError: Math.abs(a.left - b.left), widthError: Math.abs(a.width - b.width) };
            });
          });
          for (const column of alignment) {
            expect(column.leftError, `${source} scroll ${position}, ${column.date}: ${JSON.stringify(column)}`).toBeLessThan(1);
            expect(column.widthError, `${column.date} column width`).toBeLessThan(1);
          }
        }
      }
    });
  }
}
