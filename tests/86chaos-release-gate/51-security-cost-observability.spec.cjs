const { test, expect } = require('@playwright/test');
const { creds, requireCreds, login, gotoTab, watchForProblems, bodyText } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('51 security maturity and Firebase cost observability', () => {
  test('system admin refreshes sanitized diagnostics while staff remains gated', async ({ browser }) => {
    test.setTimeout(10 * 60 * 1000);
    const system=creds('SYSTEM_ADMIN'),staff=creds('STAFF');requireCreds(system,'system admin');requireCreds(staff,'staff');
    const adminContext=await browser.newContext();const admin=await adminContext.newPage();const problems=[];watchForProblems(admin,problems);
    await login(admin,system.email,system.password);await gotoTab(admin,'godmode',{settleMs:1200});
    const securityButton=admin.getByRole('button',{name:/^(?:Open\s+)?Security Center$/i}).first();await expect(securityButton).toBeVisible();await securityButton.click();
    await expect(admin.getByTestId('security-maturity-diagnostics')).toBeVisible();
    await admin.getByRole('button',{name:/Refresh Security Center/i}).click();
    await expect(admin.getByTestId('security-maturity-diagnostics')).toContainText(/MFA|App Check|environment|deployment identity/i,{timeout:60000});
    await expect(admin.getByTestId('firebase-cost-observability')).toContainText(/Duplicate listeners|Documents observed/i);
    const adminText=await bodyText(admin,50000);expect(adminText).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+eyJ|AIza[0-9A-Za-z_-]{20,}|password\s*[:=]\s*[^\s]+/i);
    expect(problems.filter(row=>['page-error','http-5xx'].includes(row.type)),JSON.stringify(problems,null,2)).toEqual([]);await adminContext.close();
    const staffContext=await browser.newContext();const staffPage=await staffContext.newPage();await login(staffPage,staff.email,staff.password);const staffText=await gotoTab(staffPage,'godmode',{settleMs:900});expect(staffText).not.toMatch(/Actionable Security Maturity|Firebase \/ RTDB Cost Observability/i);await staffContext.close();
  });
});
