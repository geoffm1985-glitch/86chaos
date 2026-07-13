# QA 15.0.63 — Maintenance Mode Hotfix

## Smoke tests

- [ ] Log in as Master Admin/System Admin.
- [ ] Open System Administrator.
- [ ] Open Maintenance Mode Controls.
- [ ] Choose one test workspace.
- [ ] Add a custom maintenance message.
- [ ] Leave Scheduled Start blank.
- [ ] Leave Auto-Unlock Time blank.
- [ ] Click Enable Maintenance.
- [ ] Confirm no Firestore `undefined` value toast appears.
- [ ] Confirm the selected workspace receives maintenance fields.
- [ ] Confirm Super Admin/System Admin can still enter the workspace.
- [ ] Confirm a normal staff account sees the maintenance screen.
- [ ] Click Clear Maintenance.
- [ ] Confirm maintenance mode clears without an `undefined` value toast.
- [ ] Confirm stale maintenance message/audience/start/end fields are cleared or null.

## Date/time tests

- [ ] Enable maintenance with Auto-Unlock Time set.
- [ ] Confirm `maintenanceEndsAt` saves safely.
- [ ] Enable maintenance with Scheduled Start set.
- [ ] Confirm `maintenanceStartsAt` saves safely.
- [ ] Enable maintenance with both date fields blank.
- [ ] Confirm blank dates save as `null`, not `undefined`.

## Scope tests

- [ ] Enable maintenance for one workspace only.
- [ ] Confirm other workspaces are not changed.
- [ ] Enable maintenance globally only on a non-production/test environment first.
- [ ] Confirm every target workspace updates successfully.
- [ ] Clear maintenance globally only on a non-production/test environment first.

## Regression checks

- [ ] Existing app tabs still load.
- [ ] Voice Command dock still opens.
- [ ] System Administrator still opens.
- [ ] Push Notification Center still opens.
- [ ] Plan/Billing still opens.
- [ ] No new Firebase rules deployment is required.
- [ ] Vercel deploy succeeds with existing `FIREBASE_SERVICE_ACCOUNT_KEY` and `CRON_SECRET`.

