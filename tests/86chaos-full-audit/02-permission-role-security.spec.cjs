const { test, expect } = require('@playwright/test');
const { creds, ownerLikeCreds, requireCreds, login, gotoTab, bodyText, attachJson, STAFF_FORBIDDEN_RE, STAFF_ACTION_RE, PERMISSION_GATE_RE } = require('./utils/audit-helpers.cjs');

const collectProtectedControls = async (locator) => locator.evaluateAll(nodes => nodes.map(node => ({
  text: (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim(),
  aria: node.getAttribute('aria-label') || '',
  title: node.getAttribute('title') || '',
  hidden: node.offsetParent === null || node.getAttribute('aria-hidden') === 'true'
})));

test.describe('02 role permissions and direct-route security', () => {
  test('protected-control evaluator returns a normal array for visible controls', async ({ page }) => {
    await page.setContent(`
      <button aria-label="System Administrator">gear</button>
      <a href="#" title="Backup Center">backup</a>
      <button style="display:none" aria-label="Hidden wages">hidden</button>
    `);
    const controls = await collectProtectedControls(page.locator('button, a, [role="button"], [role="menuitem"], [role="tab"]'));
    expect(Array.isArray(controls)).toBe(true);
    expect(controls.filter(control => !control.hidden).map(control => `${control.text} ${control.aria} ${control.title}`)).toEqual(expect.arrayContaining([expect.stringMatching(/System Administrator/), expect.stringMatching(/Backup Center/)]));
  });

  test('staff account cannot see or use owner/system-admin-only surfaces', async ({ page }, testInfo) => {
    const staff = creds('STAFF');
    if (!staff.email || !staff.password) test.skip(true, 'STAFF_EMAIL/STAFF_PASSWORD not configured. Add them to test staff permission leaks.');
    await login(page, staff.email, staff.password);
    const checked = [];
    for (const tab of ['today', 'schedule', 'financials', 'back-office', 'team', 'settings', 'godmode', 'audit']) {
      const text = await gotoTab(page, tab, { settleMs: 1200 });
      let protectedControls = [];
      try {
        protectedControls = await collectProtectedControls(page.locator('button, a, [role="button"], [role="menuitem"], [role="tab"]'));
      } catch (error) {
        throw new Error(`Protected-control evaluator failed on ${tab}: ${error?.message || error}`);
      }
      const visibleProtectedControls = protectedControls.filter(control => !control.hidden && STAFF_FORBIDDEN_RE.test(`${control.text} ${control.aria} ${control.title}`));
      const directRouteLeak = ['godmode', 'audit'].includes(tab) && !PERMISSION_GATE_RE.test(text) && /Backup Center|Security Center|Forensics|Platform Operations|Python Automation/i.test(text);
      const actionLeak = tab !== 'team' && STAFF_ACTION_RE.test(text);
      checked.push({ tab, hasGate: PERMISSION_GATE_RE.test(text), directRouteLeak, visibleProtectedControls, actionLeak, sample: text.slice(0, 1800) });
    }
    await attachJson(testInfo, '02-staff-permissions.json', { checked });
    const leaks = checked.filter(x => x.directRouteLeak || x.actionLeak || x.visibleProtectedControls.length);
    expect(leaks, 'Staff should not see protected routes, owner/system-admin controls, wage actions, Python automation, QuickBooks, or destructive owner actions').toEqual([]);
  });

  test('manager account does not see system admin unless explicitly configured as admin', async ({ page }, testInfo) => {
    const manager = creds('MANAGER');
    if (!manager.email || !manager.password) test.skip(true, 'MANAGER_EMAIL/MANAGER_PASSWORD not configured.');
    await login(page, manager.email, manager.password);
    const text = await gotoTab(page, 'godmode', { settleMs: 1200 });
    const allowed = /System Administrator|People Directory|Backup Center|Security Center/i.test(text) && !PERMISSION_GATE_RE.test(text);
    await attachJson(testInfo, '02-manager-system-admin-route.json', { allowed, sample: text.slice(0, 2500) });
    if (!/^(1|true|yes)$/i.test(process.env.CHAOS_MANAGER_SHOULD_HAVE_SYSTEM_ADMIN || '')) {
      expect(allowed, 'Manager should not get full System Administrator access unless CHAOS_MANAGER_SHOULD_HAVE_SYSTEM_ADMIN=true').toBe(false);
    }
  });

  test('demo/read-only mode does not expose obvious write buttons', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const findings = [];
    for (const tab of ['today', 'schedule', 'inventory', 'financials', 'messages', 'maintenance']) {
      const text = await gotoTab(page, tab);
      if (/Demo Mode|Read Only|read-only/i.test(text) && /Save|Create|Delete|Publish|Send|Approve|Clock In/i.test(text)) findings.push({ tab, sample: text.slice(0, 2000) });
    }
    await attachJson(testInfo, '02-demo-readonly-write-findings.json', { findings });
    expect(findings, 'If a screen declares demo/read-only, it should not show obvious live write actions').toEqual([]);
  });
});
