# 86 Chaos 14.0.0 Release Notes

## Version 14.0.0: Robustness Suite

This major build hardens the app instead of adding another loose pile of buttons.

### Added

- System Administrator → **14.0 Robustness Suite**.
- **Safe Write Engine** helpers for permission checks, restaurantId enforcement, demo-mode blocking, audit logging, redacted before/after details, and offline queue support.
- New `/api/safe-write` route for server-verified protected writes.
- **Upload & Storage Doctor** with `/api/storage-doctor` to test Firebase Admin credentials, the active Storage bucket, workspace lookup, and real write/read/delete behavior.
- **Schema Doctor & Data Repair** with `/api/schema-doctor` to scan tenant records for missing restaurant IDs, invalid dates, stale punches, negative inventory, old branding fields, and demo privacy hazards.
- **Point-in-time Backup Preview** with `/api/backup-preview` to inspect backups before restore, flag sensitive fields, count documents by collection, and selectively restore chosen collections after typing `RESTORE`.
- **Permission Simulator** for Super Admin review of visible tabs, blocked tabs, wage visibility, backup access, and forensics access.
- **Import Bridge templates** for Toast/Square/Clover sales, payroll time, vendor invoices, and inventory counts.
- **Release Guardrail Tests** for version, brand lock, demo privacy rule, Help Center boundary, and bundled rules.
- Ops Center **Menu Dependency Radar** connecting low-stock inventory to recipes/menu items.
- Line Check **corrective action required** for out-of-range food-safety temperatures.

### Security / permissions

- 86 Chaos branding remains mandatory and locked.
- Restaurant/customer logos remain uploadable and displayable beside 86 Chaos branding.
- Demo mode remains protected from real private customer/employee data.
- Backup preview and selective restore are Super Admin only.
- Storage Doctor and Schema Doctor allow Super Admin access and limited workspace-admin diagnostic access for the selected tenant.
- Firestore rules now recognize `menuDependencies` and `offlineWriteReceipts` as tenant-scoped collections.

### Files added

- `api/_chaos-admin.js`
- `api/storage-doctor.js`
- `api/schema-doctor.js`
- `api/backup-preview.js`
- `api/safe-write.js`
- `README_14_0_0_RELEASE_NOTES.md`
- `QA_14_0_0_ROBUSTNESS_SUITE.md`

### Deploy notes

- Deploy the app through Vercel/GitHub.
- Publish `firestore.rules` separately.
- Publish `storage.rules` separately.
- Confirm Vercel has the Firebase Admin service account variables and Storage bucket set for the same Firebase project as the deployed site.
