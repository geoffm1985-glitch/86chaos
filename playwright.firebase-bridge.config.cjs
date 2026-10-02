const { defineConfig, devices } = require('@playwright/test');
const bridge = require('./yardmaster.firebase.json');
process.env.YARDMASTER_FIREBASE_TARGET = 'emulator';
module.exports = defineConfig({
  testDir: './tests/86chaos-release-gate',
  testMatch: '69-yardmaster-firebase-bridge-17-0-57.spec.cjs',
  timeout: 60000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: bridge.localApp.url, trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run start:yardmaster',
    url: bridge.localApp.url + bridge.localApp.readyPath,
    timeout: 180000,
    reuseExistingServer: false,
    env: { YARDMASTER_FIREBASE_TARGET: 'emulator' }
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } }
  ]
});
