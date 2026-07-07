# QA Checklist: 86 Chaos 14.0.1 Safe Write, Dependency Graph, and Backup Picker

## Deploy / version

- [ ] Deploy the ZIP through GitHub/Vercel.
- [ ] Open the app and confirm the version check does not show an update mismatch.
- [ ] Confirm `public/version.json` reports `14.0.1`.
- [ ] Publish `firestore.rules` to the correct Firebase project.
- [ ] Confirm `/api/list-backups`, `/api/backup-preview`, `/api/safe-write`, `/api/storage-doctor`, `/api/schema-doctor`, and `/api/brand-logo` are live.

## Safe Write wiring

- [ ] Add, edit, and delete a prep item.
- [ ] Complete and un-complete a prep item.
- [ ] Add a line check item and log a safe temperature.
- [ ] Log an out-of-range temperature and confirm corrective action is required.
- [ ] Add and complete a task.
- [ ] Add/edit an inventory item, adjust stock, and adjust par.
- [ ] Add/edit a vendor.
- [ ] Add a waste log and confirm stock changes correctly.
- [ ] Create a pending order, update pending quantity, receive it, and cancel a different pending order.
- [ ] Add/edit/delete a recipe.
- [ ] Add/edit/close a maintenance log.
- [ ] Add a PM schedule and mark it completed.
- [ ] Use Today quick actions for 86 alert, prep, message, and maintenance, then test undo.

## Menu Dependency Graph

- [ ] Open Ops Center → Recipe & Menu Brain.
- [ ] Map a recipe/menu item to an inventory item.
- [ ] Confirm the dependency appears in the graph list.
- [ ] Set the linked inventory item below par.
- [ ] Confirm Menu Impact and Menu Dependency Radar show the affected recipe/menu item.
- [ ] Remove the dependency and confirm the graph list updates.
- [ ] Post a related 86 alert and confirm the radar recognizes active 86 signals where relevant.

## Backup picker / restore preview

- [ ] Open System Administrator → 14.0 Robustness Suite as Super Admin.
- [ ] Click **Load Backups**.
- [ ] Confirm available Firebase Storage backups appear in the selector.
- [ ] Choose a backup and click **Preview Backup**.
- [ ] Confirm collection counts, warnings, restaurant IDs, and sensitive-field badges display.
- [ ] Use **Select All** and **Clear** for selected collections.
- [ ] Confirm **Selective Restore** does nothing unless `RESTORE` is typed.
- [ ] Do not run an actual production restore unless a backup-first plan has been completed.

## Permissions / demo safety

- [ ] Confirm a user without prep/inventory/team access cannot create menu dependency links.
- [ ] Confirm demo mode cannot make live Safe Write changes.
- [ ] Confirm System Administrator backup tools are not exposed to normal staff/demo users.
- [ ] Confirm restaurant/customer logo display still works and 86 Chaos branding remains mandatory.
