# QA Checklist: 86 Chaos 14.0.0 Robustness Suite

## Deploy / version

- [ ] Deploy the ZIP through GitHub/Vercel.
- [ ] Open the app and confirm the version check does not show an update mismatch.
- [ ] Confirm `public/version.json` reports `14.0.0`.
- [ ] Publish `firestore.rules` to the correct Firebase project.
- [ ] Publish `storage.rules` to the correct Firebase project.

## Branding

- [ ] Confirm 86 Chaos branding is always visible.
- [ ] Upload a restaurant/customer logo from Settings → Branding.
- [ ] Confirm the restaurant logo can display beside 86 Chaos branding.
- [ ] Confirm there is no setting that hides/replaces 86 Chaos branding.

## System Administrator → 14.0 Robustness Suite

- [ ] Open System Administrator as Super Admin.
- [ ] Confirm the new **14.0 Robustness Suite** section appears.
- [ ] Select the Cheers Chilton workspace or current workspace.
- [ ] Run **Storage Doctor** and confirm it reports the project/bucket checks.
- [ ] Run **Schema Doctor Dry Run** and confirm it returns a report instead of crashing.
- [ ] Run **Release Guardrails** and confirm the version/brand/demo/help/rules checks appear.
- [ ] Select a user in **Permission Simulator** and confirm allowed/blocked tabs make sense.
- [ ] Download **Import Bridge** templates and confirm the file includes POS, payroll, invoice, and inventory templates.

## Backup Preview / selective restore safety

- [ ] Paste a known backup Storage path.
- [ ] Click **Preview Backup**.
- [ ] Confirm collections, counts, restaurant IDs, and warnings display.
- [ ] Confirm **Selective Restore** does nothing unless `RESTORE` is typed.
- [ ] Do not run an actual restore on production unless a backup-first plan has been completed.

## Ops Center dependency engine

- [ ] Create or identify a recipe containing an ingredient name that also exists in Inventory.
- [ ] Set that inventory item below par.
- [ ] Open Ops Center.
- [ ] Confirm **Menu Impact** and **Menu Dependency Radar** show the affected recipe/menu item.
- [ ] Confirm items with pending quantities show recovery language.

## Line Check food safety

- [ ] Open Prep → Line Check.
- [ ] Enter an out-of-range temperature.
- [ ] Confirm the app requires a corrective action note before logging.
- [ ] Enter a corrective action and log the temperature.
- [ ] Confirm the temp log saves with danger status and corrective-action text.

## API routes

- [ ] Confirm `/api/storage-doctor` is deployed.
- [ ] Confirm `/api/schema-doctor` is deployed.
- [ ] Confirm `/api/backup-preview` is deployed.
- [ ] Confirm `/api/safe-write` is deployed.
- [ ] Confirm `/api/brand-logo` still works for restaurant logo upload.

## Demo / privacy

- [ ] Enter demo mode.
- [ ] Confirm real email, phone, address, wage, and sensitive admin data are not shown.
- [ ] Confirm System Administrator and backup/forensics tools are not exposed to demo users.
