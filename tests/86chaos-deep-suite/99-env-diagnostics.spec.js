// 86 Chaos Playwright env diagnostics
// Run this alone when tests skip/fail before login.
const { test, expect } = require('@playwright/test');
const {
  BASE_URL,
  EXPECTED_VERSION,
  ownerLikeCreds,
  staffCredsOrNull,
  hasCreds,
  envDebugSummary,
} = require('./utils/chaos-helpers');

test.describe('86 Chaos Env Diagnostics', () => {
  test('Playwright can see required .env values', async ({}, testInfo) => {
    const owner = ownerLikeCreds();
    const staff = staffCredsOrNull();
    const debug = envDebugSummary();

    await testInfo.attach('env-diagnostics.json', {
      body: JSON.stringify({ BASE_URL, EXPECTED_VERSION, ownerSeen: !!(owner.email && owner.password), staffSeen: !!(staff?.email && staff?.password), managerSeen: hasCreds('MANAGER'), debug }, null, 2),
      contentType: 'application/json',
    });

    console.log('86 CHAOS ENV DIAGNOSTICS:', JSON.stringify({ BASE_URL, EXPECTED_VERSION, ownerEmail: owner.email || null, ownerPasswordSeen: !!owner.password, staffEmail: staff?.email || null, staffPasswordSeen: !!staff?.password, debug }, null, 2));

    expect(BASE_URL, 'APP_URL or CHAOS_BASE_URL should be set').toMatch(/^https?:\/\//);
    expect(EXPECTED_VERSION, 'CHAOS_EXPECTED_VERSION should be 15.0.95').toBe('15.0.95');
    expect(owner.email, 'OWNER_EMAIL or TEST_EMAIL should be visible to Playwright').toBeTruthy();
    expect(owner.password, 'OWNER_PASSWORD or TEST_PASSWORD should be visible to Playwright').toBeTruthy();
  });
});
