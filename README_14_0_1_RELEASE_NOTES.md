# 86 Chaos 14.0.1 Release Notes

## Version 14.0.1: Safe Write Wiring, Dependency Graph, and Backup Picker

This build tightens the v14 Robustness Suite around the places kitchens actually touch during service: inventory, prep, line checks, recipes, maintenance, 86 alerts, and point-in-time restore preview.

### Added / improved

- Wired the **Safe Write Engine** into major kitchen operations, including prep items, line checks, temperature logs, task completion, inventory edits, stock/par updates, vendors, waste logs, pending orders, invoice-driven inventory updates, recipes, maintenance logs, PM schedules, Ops Center smart actions, Today quick actions, and demo seed actions.
- Added safe-write undo support for Today quick actions so quick 86/prep/message/maintenance posts can be removed through the same guarded write path.
- Added an **Ops Center Dependency Graph Editor** so managers can manually map recipes/menu items to inventory items instead of relying only on text matching.
- Upgraded **Menu Dependency Radar** to combine manual graph links, low-stock inventory, prep signals, and active 86 alerts.
- Added a **backup picker** in System Administrator → 14.0 Robustness Suite so Super Admins can load Firebase Storage backups and choose a snapshot before previewing or selectively restoring.
- Kept the advanced manual backup path fallback for emergency/debug use.
- Added collection select-all/clear controls and sensitive-field badges to Backup Preview.

### Security / permissions

- Safe Write continues to enforce restaurantId, user permissions, demo-mode blocking, audit logging, and redacted before/after details.
- Menu dependency mapping is tenant-scoped and allowed for appropriate prep/inventory/team roles.
- Backup listing, preview, and selective restore remain protected admin workflows.
- Selective restore still requires typing `RESTORE`; the picker removes path-typing pain without removing the safety latch.

### Rules / API notes

- `firestore.rules` now recognizes `scheduleTemplates`, `scheduleCoverageTargets`, and inventory-authorized `menuDependencies` writes.
- `/api/list-backups` is used by the new picker and must be deployed with the app.
- Existing v14 routes remain required: `/api/safe-write`, `/api/storage-doctor`, `/api/schema-doctor`, `/api/backup-preview`, and `/api/brand-logo`.

### Files added

- `README_14_0_1_RELEASE_NOTES.md`
- `QA_14_0_1_SAFE_WRITE_DEPENDENCY_RESTORE_PICKER.md`

### Deploy notes

- Deploy the app through Vercel/GitHub.
- Publish `firestore.rules` separately.
- `storage.rules` is included and can be re-published if your Firebase Storage rules are not already current.
- Confirm Vercel has the Firebase Admin service account variables and Storage bucket set for the same Firebase project as the deployed site.
