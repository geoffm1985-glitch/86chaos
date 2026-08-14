const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { loginIfNeeded, gotoAuthenticatedRoute, assertAuthenticatedAfterNavigation } = require('./utils/release-login-helper.cjs');

const releaseGate = process.env.CHAOS_RELEASE_GATE === 'true';
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for cost-regression capture.`);
  return value;
};

const scenarios = [
  { name: 'owner-today', email: 'OWNER_EMAIL', password: 'OWNER_PASSWORD', tab: 'today' },
  { name: 'recipes', email: 'OWNER_EMAIL', password: 'OWNER_PASSWORD', tab: 'recipes' },
  { name: 'operations-center', email: 'MANAGER_EMAIL', password: 'MANAGER_PASSWORD', tab: 'ops' },
  { name: 'staff-my-schedule', email: 'STAFF_EMAIL', password: 'STAFF_PASSWORD', tab: 'published' },
  { name: 'manager-schedule-builder', email: 'MANAGER_EMAIL', password: 'MANAGER_PASSWORD', tab: 'schedule', subtab: /schedule builder/i },
  { name: 'staff-time-off', email: 'STAFF_EMAIL', password: 'STAFF_PASSWORD', tab: 'published', subtab: /Request Off/i },
  { name: 'staff-availability', email: 'STAFF_EMAIL', password: 'STAFF_PASSWORD', tab: 'published', subtab: /Availability/i },
  { name: 'personal-reminders', email: 'STAFF_EMAIL', password: 'STAFF_PASSWORD', tab: 'reminders' },
  { name: 'system-admin-overview', email: 'SYSTEM_ADMIN_EMAIL', password: 'SYSTEM_ADMIN_PASSWORD', tab: 'godmode' },
  { name: 'bug-ledger', email: 'SYSTEM_ADMIN_EMAIL', password: 'SYSTEM_ADMIN_PASSWORD', tab: 'godmode', subtab: /Open Support Diagnostics/i },
  { name: 'audit-logs', email: 'SYSTEM_ADMIN_EMAIL', password: 'SYSTEM_ADMIN_PASSWORD', tab: 'audit' },
  { name: 'background-return', email: 'OWNER_EMAIL', password: 'OWNER_PASSWORD', tab: 'today', action: 'background' },
  { name: 'select-active-workspace', email: 'OWNER_EMAIL', password: 'OWNER_PASSWORD', tab: 'today', action: 'select-current-workspace' },
  { name: 'unchanged-push-token', email: 'OWNER_EMAIL', password: 'OWNER_PASSWORD', tab: 'settings', action: 'reload-for-push-sync' }
];

async function loginNeutral(page, emailKey, passwordKey) {
  await page.goto('/?tab=help', { waitUntil: 'domcontentloaded' });
  await loginIfNeeded(page, required(emailKey), required(passwordKey), { timeout: 30_000 });
  await gotoAuthenticatedRoute(page, 'help', { timeout: 30_000 });
}

async function resetDiagnostics(page) {
  await page.evaluate(() => { window.__chaosFirestoreDiagnostics = null; });
}

async function diagnostics(page) {
  return page.evaluate(() => {
    const d = window.__chaosFirestoreDiagnostics || {};
    const listeners = d.listeners || {};
    return {
      totals: {
        listenerCreations: Object.values(listeners).reduce((n, row) => n + Number(row.listenerCreationCount || 0), 0),
        listenerReuses: Number(d.listenerReuseCount || 0),
        initialDocuments: Object.values(listeners).reduce((n, row) => n + Number(row.documentsReceivedInitial || 0), 0),
        documentChanges: Object.values(listeners).reduce((n, row) => n + Number(row.documentsReceivedChanges || 0), 0),
        writesInitiated: Number(d.writesInitiated || 0),
        writesCompleted: Number(d.writesCompleted || 0),
        auditWritesCreated: Number(d.auditWritesCreated || 0),
        skippedNoOpWrites: Number(d.skippedNoOpWrites || 0)
      },
      listeners,
      activeListenerKeys: listeners,
      capturedAt: new Date().toISOString()
    };
  });
}

async function openScenario(page, scenario) {
  await gotoAuthenticatedRoute(page, scenario.tab, { timeout: 30_000 });
  if (scenario.subtab) {
    const control = page.getByRole('button', { name: scenario.subtab }).first().or(page.getByText(scenario.subtab).first());
    await expect(control, `${scenario.name} subtab control`).toBeVisible({ timeout: 12_000 });
    await control.click();
    await assertAuthenticatedAfterNavigation(page, { timeout: 20_000 });
  }
  if (scenario.action === 'background') {
    await page.evaluate(() => {
      window.__chaosQaVisibilityState = 'hidden';
      try { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__chaosQaVisibilityState }); } catch (_) {}
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(61_000);
    await page.evaluate(() => { window.__chaosQaVisibilityState = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(1000);
  } else if (scenario.action === 'select-current-workspace') {
    const trigger = page.getByRole('button', { name: /switch workspace/i }).first();
    await expect(trigger, 'workspace switcher trigger').toBeVisible({ timeout: 8000 });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: /switch workspace/i }).first()
      .or(page.getByRole('dialog').filter({ hasText: /switch workspace/i }).first());
    await expect(dialog, 'workspace switcher dialog should be visible before selecting the current workspace').toBeVisible({ timeout: 8000 });
    const current = dialog.locator('[data-testid="workspace-switcher-current-workspace"]').first()
      .or(dialog.getByRole('button', { name: /current workspace/i }).first())
      .or(dialog.getByText(/\bcurrent\b/i).locator('..').first());
    if (await current.isVisible({ timeout: 5000 }).catch(() => false)) {
      await current.click({ trial: true }).catch(() => {});
      await current.click().catch(async () => dialog.getByRole('button', { name: /close/i }).click());
    } else {
      await dialog.getByRole('button', { name: /close/i }).click();
    }
    await assertAuthenticatedAfterNavigation(page, { timeout: 20_000 });
  } else if (scenario.action === 'reload-for-push-sync') {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertAuthenticatedAfterNavigation(page, { timeout: 30_000 });
    await page.waitForTimeout(1500);
  } else {
    await page.waitForTimeout(1000);
  }
}

for (const scenario of scenarios) {
  test(`cost scenario ${scenario.name}`, async ({ page }) => {
    const outDir = process.env.CHAOS_COST_SCENARIO_REPORT_DIR || path.join(process.cwd(), 'test-results', 'cost-scenarios');
    fs.mkdirSync(outDir, { recursive: true });
    await loginNeutral(page, scenario.email, scenario.password);
    await resetDiagnostics(page);
    const before = await diagnostics(page);
    await openScenario(page, scenario);
    const after = await diagnostics(page);
    fs.writeFileSync(path.join(outDir, `${scenario.name}.json`), JSON.stringify({ scenario: scenario.name, before, after }, null, 2));
    expect(after.capturedAt).toBeTruthy();
  });
}
