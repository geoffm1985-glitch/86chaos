'use strict';
const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, creds, requireCreds, login, gotoTab, appUrl } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('17.0.26 Phase 1 Spanish interface', () => {
  test('a user can switch their own interface to Spanish and core Phase 1 navigation follows it', async ({ page }) => {
    const projectName = test.info().project.name;
    const manager = creds('MANAGER');
    const account = projectName === 'mobile-chromium' && manager.email ? manager : ownerLikeCreds();
    requireCreds(account, 'owner/admin-like');
    await login(page, account.email, account.password, { chooseWorkspace: true });
    await gotoTab(page, 'settings');

    const preferencesTab = page.getByRole('button', { name: /preferences|preferencias/i }).first();
    await expect(preferencesTab).toBeVisible({ timeout: 15000 });
    await preferencesTab.click();

    const language = page.getByTestId('app-language-select');
    await expect(language).toBeVisible();
    const originalLanguage = await language.inputValue();

    try {
      await language.selectOption('es');
      await page.getByRole('button', { name: /save preferences|guardar preferencias/i }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'es', { timeout: 15000 });
      await expect(page.locator('button.settings-tab-button').filter({ hasText: /^Preferencias$/i }).first()).toBeVisible();

      await page.getByRole('button', { name: /open navigation menu/i }).click();
      const drawer = page.getByRole('dialog', { name: /menú principal|main menu/i });
      await expect(drawer).toBeVisible();
      await expect(drawer.locator('[data-shell-route="published"]')).toContainText('Reloj y horario');
      await expect(drawer.locator('[data-shell-route="prep"]')).toContainText('Preparación y tareas');
      await expect(drawer.locator('[data-shell-route="settings"]')).toContainText('Configuración');
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
      const prefs = page.getByRole('button', { name: /preferences|preferencias/i }).first();
      if (await prefs.isVisible().catch(() => false)) await prefs.click();
      const restore = page.getByTestId('app-language-select');
      if (await restore.isVisible().catch(() => false)) {
        await restore.selectOption(originalLanguage || 'en');
        const save = page.getByRole('button', { name: /save preferences|guardar preferencias/i }).first();
        if (await save.isVisible().catch(() => false)) {
          await save.click();
          await expect(page.locator('html')).toHaveAttribute('lang', /^(en|es)$/i, { timeout: 15000 });
          await expect(page.locator('html')).toHaveAttribute('lang', (originalLanguage || 'en').toLowerCase(), { timeout: 15000 });
        }
      }
    }
  });
});
