const { test, expect } = require('@playwright/test');
const {
  ownerLikeCreds,
  requireCreds,
  login,
  gotoTab,
  dismissBlockingDialogs,
  BASE_URL,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { readFirebaseConfig, readConfiguredAccounts, signInAccount } = require('../../scripts/86chaos-release-gate/verify-role-accounts.cjs');

const QA_TEST_PROJECT_ID = 'chaos-test-d1601';

function requireSafeQaTarget() {
  const config = readFirebaseConfig();
  if (config?.projectId !== QA_TEST_PROJECT_ID) throw new Error(`Refusing staff email edit E2E outside ${QA_TEST_PROJECT_ID}: ${config?.projectId || 'unknown'}`);
  if (/app\.86chaos\.com|cheers-34b8d|production/i.test(String(BASE_URL || ''))) throw new Error(`Refusing staff email edit E2E against production URL: ${BASE_URL}`);
}

async function getSystemAdminToken() {
  requireSafeQaTarget();
  const account = readConfiguredAccounts().find(row => row.key === 'systemAdmin');
  if (!account?.email || !account?.password) throw new Error('System Administrator QA account credentials are required for staff email cleanup.');
  const signed = await signInAccount(account, readFirebaseConfig());
  if (!signed?.idToken) throw new Error('System Administrator QA account did not return an ID token.');
  return signed.idToken;
}

test.describe('Staff Roster login email editing', () => {
  let disposableUid = '';

  test.afterEach(async ({ request }) => {
    if (!disposableUid) return;
    const idToken = await getSystemAdminToken().catch(() => '');
    if (!idToken) return;
    await request.post(`${BASE_URL}/api/delete-user`, {
      headers: { Authorization: `Bearer ${idToken}` },
      data: { targetUid: disposableUid, reason: 'staff-email-edit-e2e-cleanup' }
    }).catch(() => null);
    disposableUid = '';
  });

  test('Manager changes an employee login email and the new email authenticates', async ({ page, context }) => {
    requireSafeQaTarget();
    const account = ownerLikeCreds();
    requireCreds(account, 'QA manager/owner account');
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const beforeEmail = `staff-email-before.${runId}@86chaos.test`;
    const afterEmail = `staff-email-after.${runId}@86chaos.test`;
    let tempPassword = '';

    await login(page, account.email, account.password);
    await gotoTab(page, 'team', { settleMs: 1400, maxText: 60000 });
    await dismissBlockingDialogs(page, { maxPasses: 4 }).catch(() => null);

    const createResponsePromise = page.waitForResponse(resp => resp.url().includes('/api/staff-member') && resp.request().method() === 'POST');
    await page.getByLabel(/Name/i).fill(`QA Email ${runId}`);
    await page.getByLabel(/^Email$/i).fill(beforeEmail);
    await page.getByLabel(/Phone/i).fill('555-0100');
    await page.getByRole('button', { name: /ADD STAFF/i }).click();
    const createResponse = await createResponsePromise;
    const createJson = await createResponse.json().catch(() => ({}));
    expect(createResponse.ok()).toBeTruthy();
    disposableUid = createJson.uid || '';
    expect(disposableUid).toBeTruthy();
    const modal = page.locator('text=Employee Login Created').locator('..').locator('..');
    const modalText = await page.locator('body').innerText();
    const passMatch = modalText.match(/Temporary Password\s+([A-Za-z0-9!@#$%^&*_.-]+)/i);
    tempPassword = createJson.tempPassword || passMatch?.[1] || '';
    expect(tempPassword).toBeTruthy();

    await page.getByRole('button', { name: /Done/i }).click().catch(() => null);
    const row = page.locator('body').getByText(beforeEmail).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    const editButton = page.locator('div').filter({ hasText: beforeEmail }).first().getByRole('button').first();
    await editButton.click();
    const emailInput = page.getByLabel(/^Email$/i);
    await expect(emailInput).toBeEnabled();
    page.once('dialog', dialog => dialog.accept());
    await emailInput.fill(afterEmail);
    await page.getByRole('button', { name: /UPDATE STAFF PROFILE/i }).click();
    await expect(page.locator('body')).toContainText(/Email Updated|Updated/i, { timeout: 20000 });
    await expect(page.locator('body')).toContainText(afterEmail, { timeout: 20000 });

    const fresh = await context.browser().newContext();
    const freshPage = await fresh.newPage();
    await freshPage.goto(BASE_URL);
    await freshPage.getByLabel(/email/i).fill(afterEmail);
    await freshPage.getByLabel(/password/i).fill(tempPassword);
    await freshPage.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(freshPage.locator('body')).toContainText(/password|change|86 Chaos|workspace/i, { timeout: 20000 });
    await fresh.close();

    const oldCtx = await context.browser().newContext();
    const oldPage = await oldCtx.newPage();
    await oldPage.goto(BASE_URL);
    await oldPage.getByLabel(/email/i).fill(beforeEmail);
    await oldPage.getByLabel(/password/i).fill(tempPassword);
    await oldPage.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(oldPage.locator('body')).toContainText(/invalid|not found|wrong|failed|error/i, { timeout: 20000 });
    await oldCtx.close();
  });
});
