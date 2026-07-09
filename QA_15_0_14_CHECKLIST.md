# QA Checklist - 86 Chaos 15.0.14

## Version/deploy

- [ ] Deploy to Vercel.
- [ ] Confirm `/version.json` reports `15.0.14`.
- [ ] Confirm the footer shows Version 15.0.14 after refresh.

## AI Tools

- [ ] Sign in as an admin/manager.
- [ ] Open the drawer and verify **AI Tools** appears.
- [ ] Open AI Tools.
- [ ] Confirm Menu Intelligence shortcut opens Menu Intelligence when permitted.
- [ ] Confirm Invoice Scanner shortcut opens Inventory.
- [ ] Confirm Voice Commands shortcut opens Help Center.
- [ ] Confirm Smart Prep Matching shortcut opens Prep.

## Problem reporting and diagnostics

- [ ] Click the header bug/report button.
- [ ] Confirm Report Problem modal opens.
- [ ] Confirm diagnostics include app version, Firebase project, host, online state, notification permission, camera/mic support, local storage, offline queue, and screen size.
- [ ] Submit a test report.
- [ ] Confirm a `crashReports` document is created.
- [ ] Trigger a harmless failed/blocked action and confirm the toast includes **Report Problem**.

## Offline queue visibility

- [ ] Simulate offline mode or use an existing queued write if available.
- [ ] Confirm the shell shows queued action count.
- [ ] Open Report Problem and confirm offline queue count appears.
- [ ] Press Try Sync Offline Queue after returning online.

## Health Dashboard

- [ ] Open System Administrator → Health Dashboard.
- [ ] Press Refresh Health.
- [ ] Confirm `/api/health-checks` appears as Full API Route Manifest.
- [ ] Confirm the API route manifest lists route rows with ready/attention state.
- [ ] Confirm `/api/health-checks` does not perform destructive actions.

## Menu Intelligence

- [ ] Upload a test menu in testing.
- [ ] Confirm review rows show confidence badges.
- [ ] Toggle one ingredient to Skip.
- [ ] Approve the scan.
- [ ] Confirm skipped ingredients are not saved to `menuDependencies`.
- [ ] Confirm approved ingredients still create menu impact links.

## Regression smoke test

- [ ] Login works.
- [ ] Drawer navigation works.
- [ ] Prep opens.
- [ ] Inventory opens.
- [ ] Menu Intelligence opens for permitted users.
- [ ] Help Center search still works.
- [ ] Shared reminders still open.
- [ ] Security Center still opens for Super Admin.
