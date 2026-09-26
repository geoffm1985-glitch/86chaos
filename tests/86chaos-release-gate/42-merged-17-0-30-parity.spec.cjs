const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const baseUrl = String(process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || '').replace(/\/$/, '');

test('17.0.31 merged deployment and source preserve both branch capability sets', async ({ request }) => {
  expect(baseUrl).toBeTruthy();
  const response = await request.get(`${baseUrl}/version.json?mergedParity=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
  expect(response.ok()).toBeTruthy();
  const version = await response.json();
  expect(version.version).toBe('17.0.31');
  expect(version.build).toBe('17.0.31');

  const schedule = read('src/features/schedule.jsx');
  const runner = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
  const mutation = read('scripts/86chaos-release-gate/mutation-safety.cjs');
  const pdf = read('src/core/schedulePdf.js');
  expect(schedule).toContain("secureFetch('/api/schedule-shift-assign'");
  expect(schedule).toContain("secureFetch('/api/schedule-shift-delete'");
  expect(schedule).toContain('useI18n');
  expect(runner).toContain('Initialize-AutoProvisionRoleAccounts');
  expect(mutation).toContain('testing.86chaos.com');
  expect(mutation).toContain('experimental.86chaos.com');
  expect(pdf).toContain('detailCells');
  expect(pdf).toContain('detailLabel');
});
