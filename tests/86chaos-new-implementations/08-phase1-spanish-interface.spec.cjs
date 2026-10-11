'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, appUrl } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { restoreCurrentQaLanguage } = require('../86chaos-full-audit/utils/qa-language-isolation.cjs');

async function openPreferencesAfterHydration(page) {
  const language = page.getByTestId('app-language-select');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const preferencesTab = page.getByRole('button', { name: /preferences|preferencias/i }).first();
    await expect(preferencesTab).toBeVisible({ timeout: 15000 });
    await preferencesTab.click();
    if (await language.isVisible().catch(() => false)) return language;
    await page.waitForTimeout(350);
  }
  await expect(language, 'Preferences must remain active after workspace/profile hydration settles').toBeVisible({ timeout: 10000 });
  return language;
}


async function saveLanguagePreference(page, value, { verifyReload = false } = {}) {
  const language = await openPreferencesAfterHydration(page);
  await language.selectOption(value);
  const save = page.getByRole('button', { name: /save preferences|guardar preferencias/i }).first();
  await expect(save, `Save Preferences must stay visible while persisting language ${value}`).toBeVisible({ timeout: 10000 });
  await save.click();
  await expect(page.locator('html')).toHaveAttribute('lang', value, { timeout: 15000 });
  await expect(language).toHaveValue(value);
  if (!verifyReload) return;
  await page.reload({ waitUntil: 'domcontentloaded' });
  const reloadedLanguage = await openPreferencesAfterHydration(page);
  await expect(reloadedLanguage, `Language ${value} must survive a fresh authenticated reload`).toHaveValue(value, { timeout: 15000 });
  await expect(page.locator('html')).toHaveAttribute('lang', value, { timeout: 15000 });
}

test.describe('17.0.26 Phase 1 Spanish interface', () => {
  // Independent of the page/test timeout: never leave the shared QA account in
  // Spanish when a navigation or assertion fails during this language journey.
  test.afterEach(async () => { await restoreCurrentQaLanguage(ownerLikeCreds()); });
  test('a user can switch their own interface to Spanish and core Phase 1 navigation follows it', async ({ page }) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner/admin-like');
    await login(page, account.email, account.password, { chooseWorkspace: true });
    await gotoTab(page, 'settings');

    await saveLanguagePreference(page, 'en');

    try {
      await saveLanguagePreference(page, 'es');
      await expect(page.locator('button.settings-tab-button').filter({ hasText: /^Preferencias$/i }).first()).toBeVisible();

      await page.getByRole('button', { name: /open navigation menu/i }).click();
      await expect(page.getByText('Reloj y horario', { exact: true })).toBeVisible();
      await expect(page.getByText('Preparación y tareas', { exact: true })).toBeVisible();
      await expect(page.getByText('Configuración', { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');

      await page.goto(appUrl('published'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: /Mi horario/i }).first()).toBeVisible({ timeout: 20000 });
      await expect(page.getByRole('button', { name: /Pedir libre/i }).first()).toBeVisible();
      await expect(page.getByText(/FICHAR (ENTRADA|SALIDA)/i).first()).toBeVisible({ timeout: 15000 });

      await page.goto(appUrl('prep'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: /Preparación/i }).first()).toBeVisible({ timeout: 20000 });
      await expect(page.getByRole('button', { name: /Control de línea/i }).first()).toBeVisible();

      await page.goto(appUrl('today'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByText(/Resumen del gerente|Resumen de cocina|Resumen del bar|Resumen de servicio|Resumen de hoy|Inicio de hoy/i).first()).toBeVisible({ timeout: 20000 });
    } finally {
      await page.goto(appUrl('settings'), { waitUntil: 'domcontentloaded' });
      await saveLanguagePreference(page, 'en', { verifyReload: true });
    }
  });
});
