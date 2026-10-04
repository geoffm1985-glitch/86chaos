'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test.describe('17.0.76 Ghost Request Off certification selector repair', () => {
  test('release-browser reliability tracks the stable employee Request Off test ID', async () => {
    const reliability = read('api/release-browser-reliability.test.cjs');
    const spec = read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs');

    expect(reliability).toContain(
      "getByTestId('schedule-request-off-tab')"
    );

    expect(reliability).not.toContain(
      "getByRole('button', { name: /^Schedule Request Off$/i })"
    );

    expect(spec).toContain(
      "gotoTab(page, 'published'"
    );

    expect(spec).toContain(
      "getByTestId('schedule-request-off-tab')"
    );
  });

  test('Ghost Request Off certification continues to prohibit Schedule Builder routing and permission elevation', async () => {
    const reliability = read('api/release-browser-reliability.test.cjs');
    const spec = read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs');

    expect(spec).not.toContain(
      "gotoTab(page, 'schedule', { settleMs: 1800, maxText: 70000 })"
    );

    expect(reliability).toContain(
      'Allen QA[\\s\\S]{0,200}Schedule Builder permission'
    );
  });
});
