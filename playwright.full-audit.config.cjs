const path = require('path');
const { defineConfig } = require('@playwright/test');

const jsonOutput = process.env.CHAOS_FULL_AUDIT_JSON || path.join('test-results', '86chaos-full-audit-report.json');
const htmlOutput = process.env.CHAOS_FULL_AUDIT_HTML || path.join('test-results', '86chaos-full-audit-html');

module.exports = defineConfig({
  testDir: './tests/86chaos-full-audit',
  timeout: 180000,
  expect: { timeout: 12000 },
  fullyParallel: false,
  workers: Number(process.env.CHAOS_FULL_AUDIT_WORKERS || 1),
  reporter: [
    ['list'],
    ['json', { outputFile: jsonOutput }],
    ['html', { outputFolder: htmlOutput, open: 'never' }],
  ],
  use: {
    headless: !/^(1|true|yes)$/i.test(process.env.CHAOS_HEADED || ''),
    viewport: { width: 1365, height: 900 },
    trace: process.env.CHAOS_TRACE === 'off' ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.CHAOS_VIDEO === 'on' ? 'retain-on-failure' : 'off',
    actionTimeout: 15000,
    navigationTimeout: 45000,
  },
});
