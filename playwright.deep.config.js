const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (_) {}
}

for (const name of ['.env.playwright.deep', '.env.playwright', '.env.local', '.env.test', '.env']) loadEnvFile(path.resolve(process.cwd(), name));

const baseURL = (process.env.CHAOS_BASE_URL || process.env.APP_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const shouldStartLocalServer = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(baseURL) && process.env.CHAOS_SKIP_WEBSERVER !== '1';
const startCommand = process.platform === 'win32' ? 'npm.cmd start' : 'npm start';

module.exports = defineConfig({
  testDir: './tests/chaos-deep-deep',
  fullyParallel: false,
  workers: Number(process.env.CHAOS_TEST_WORKERS || 1),
  retries: Number(process.env.CHAOS_TEST_RETRIES || 0),
  timeout: Number(process.env.CHAOS_TEST_TIMEOUT_MS || 240000),
  expect: { timeout: Number(process.env.CHAOS_EXPECT_TIMEOUT_MS || 20000) },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-deep-deep', open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 25000,
    navigationTimeout: 60000,
  },
  webServer: shouldStartLocalServer ? {
    command: startCommand,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120000,
    env: { ...process.env, BROWSER: 'none' },
  } : undefined,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
});
