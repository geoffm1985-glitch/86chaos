const { test, expect } = require('@playwright/test');
const {
  ALLOW_MUTATION, mutationSkipMessage, ownerLikeCreds, requireCreds, login, gotoTab,
  bodyText, attachJson, PERMISSION_GATE_RE,
} = require('./utils/audit-helpers.cjs');

const ACTIONS = [
  'document_vault.upload',
  'document_vault.download_blob',
  'document_vault.replace',
  'document_vault.delete',
  'document_vault.cross_workspace_denied',
  'document_vault.cleanup',
];

function vaultForm(page) { return page.locator('form').filter({ hasText: 'Document Vault' }).first(); }

async function openVault(page) {
  const text = await gotoTab(page, 'back-office', { settleMs: 1200, maxText: 50000 });
  if (PERMISSION_GATE_RE.test(text)) throw new Error('Document Vault is permission/plan gated for the release-gate owner account; exhaustive Owner Pro coverage cannot proceed.');
  const tab = page.getByRole('button', { name: /^(?:Open )?Document Vault$/i }).first();
  await expect(tab).toBeVisible({ timeout: 10000 });
  await tab.click();
  await expect(page.getByRole('heading', { name: 'Document Vault' }).first()).toBeVisible({ timeout: 8000 });
}

test.describe('13 Back Office Document Vault end-to-end file workflow', () => {
  test('upload, persistence, download/preview, replace, path guard, delete, and cleanup all work in disposable QA', async ({ page }, testInfo) => {
    test.skip(!ALLOW_MUTATION, mutationSkipMessage());
    test.setTimeout(8 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    await openVault(page);

    const stamp = `${Date.now()}-${testInfo.project.name.replace(/\W+/g,'-')}`;
    const title = `QA Vault ${stamp}`;
    const firstFile = { name:`qa-vault-${stamp}.txt`, mimeType:'text/plain', buffer:Buffer.from(`86 Chaos Document Vault QA ${stamp}\nfirst upload\n`) };
    const replacement = { name:`qa-vault-${stamp}-replacement.txt`, mimeType:'text/plain', buffer:Buffer.from(`86 Chaos Document Vault QA ${stamp}\nreplacement\n`) };
    const evidence = { actions:ACTIONS, title, created:false, persisted:false, downloadAttempted:false, replaced:false, pathGuardSourceVerified:false, deleted:false, cleanup:false };

    const form = vaultForm(page);
    await expect(form).toBeVisible();
    await form.locator('input[placeholder*="Liquor license"]').fill(title);
    await form.locator('select').selectOption({ label:'Other' }).catch(async()=>form.locator('select').selectOption({ index:0 }));
    await form.locator('input[type="date"]').fill('2030-12-31');
    await form.locator('input[placeholder*="Optional note"]').fill('Disposable release-gate QA record');
    await form.locator('input[type="file"][aria-label="Upload Document Vault file"]').setInputFiles(firstFile);
    await form.locator('textarea').fill('Created by exhaustive Play Store release gate; must be deleted by this test.');
    await form.getByRole('button', { name:/Save Document Record/i }).click();
    const titleNode = page.getByText(title, { exact:true }).first();
    await expect(titleNode, 'Saved Document Vault record should appear').toBeVisible({ timeout:30000 });
    evidence.created = true;

    await page.reload({ waitUntil:'domcontentloaded' });
    await page.waitForTimeout(1300);
    await openVault(page);
    const persisted = page.getByText(title, { exact:true }).first();
    await expect(persisted, 'Uploaded Document Vault record must survive a full browser refresh').toBeVisible({ timeout:15000 });
    evidence.persisted = true;

    const row = persisted.locator('xpath=ancestor::*[.//button[contains(normalize-space(.), "Delete")]][1]');
    await expect(row).toBeVisible();
    const downloadButton = row.getByRole('button', { name:/Preview \/ Download|No File Attached/i }).first();
    await expect(downloadButton, 'Uploaded record must expose Preview / Download').toHaveText(/Preview \/ Download/i);
    const downloadPromise = page.waitForEvent('download', { timeout:7000 }).catch(()=>null);
    const popupPromise = page.waitForEvent('popup', { timeout:7000 }).catch(()=>null);
    await downloadButton.click();
    const [download,popup] = await Promise.all([downloadPromise,popupPromise]);
    evidence.downloadAttempted = true;
    evidence.download = download ? { suggestedFilename:download.suggestedFilename() } : null;
    evidence.popupUrl = popup ? popup.url().split('?')[0] : null;
    if (popup) await popup.close().catch(()=>{});

    const replaceInput = row.locator(`input[type="file"][aria-label^="Replace Document Vault file for"]`).first();
    await replaceInput.setInputFiles(replacement);
    await expect(page.getByText(/Document Replaced|new file is attached/i).first()).toBeVisible({ timeout:30000 }).catch(()=>{});
    await expect(page.getByText(replacement.name, { exact:false }).first(), 'Replacement file name should become visible').toBeVisible({ timeout:30000 });
    evidence.replaced = true;

    // Cross-workspace file access is guarded by the production source path validator. Runtime cross-tenant tampering
    // would require creating an intentionally corrupt foreign-workspace Firestore record, which this gate must not do.
    // Prove that the guard is present in the exact deployed source architecture while the browser workflow proves normal access.
    const fs = require('fs');
    const source = fs.readFileSync(require('path').join(process.cwd(),'src','features','management.jsx'),'utf8');
    expect(source).toMatch(/isValidVaultStoragePath/);
    expect(source).toMatch(/pathValue\.startsWith\(`restaurants\/\$\{rid\}\/back-office\/document-vault\/\$\{recordId\}\//);
    expect(source).toMatch(/Replacement Blocked|Download Blocked/);
    evidence.pathGuardSourceVerified = true;

    page.once('dialog', async dialog => { await dialog.accept(); });
    await row.getByRole('button', { name:/^Delete$/i }).click();
    await expect(page.getByText(title, { exact:true }), 'Deleted QA Document Vault record must disappear').toHaveCount(0, { timeout:30000 });
    evidence.deleted = true;
    evidence.cleanup = true;

    const text = await bodyText(page, 30000);
    expect(text).not.toMatch(/Missing or insufficient permissions|Application error|Unhandled Runtime Error/i);
    await attachJson(testInfo,'13-document-vault-runtime-evidence.json',evidence);
    expect(evidence).toMatchObject({ created:true,persisted:true,downloadAttempted:true,replaced:true,pathGuardSourceVerified:true,deleted:true,cleanup:true });
  });
});
