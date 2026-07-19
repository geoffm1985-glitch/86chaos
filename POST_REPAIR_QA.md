# 86 Chaos 15.0.87 Post-Repair QA Checklist

## Must pass before beta use

- Deploy Firestore and Storage rules to a non-production Firebase project first.
- Sign in as owner, manager, staff, and super admin test users.
- Confirm Team Management alone cannot open or write Financials, wage data, inventory scans, invoice docs, or system tools.
- Confirm owner/admin users with explicit inventory or scan permissions can upload invoice files.
- Confirm staff cannot read invoice Storage files without invoice/inventory permission.
- Confirm profile-photo upload works for the signed-in user and fails for another user's path.
- Trigger a safe client action and confirm `/api/audit-log` creates the audit record.
- Send a problem report and confirm `/api/report-bug` creates the crash/support record.
- Confirm direct client creation of `auditLogs` and `crashReports` fails under Firestore rules.
- Create a new Founder Beta workspace and verify 90-day beta dates and `selectedFutureTier`.
- Mark a workspace canceled/expired/suspended and confirm plan-gated reads/writes are denied.
- Run invoice/menu scan permissions with custom roster role names “Admin” and “Owner” but no actual admin flag. They must not pass by role label alone.
- Test reminder dispatch for scheduled, no-token, failed-send, daily, weekly, and month-end recurring reminders.
- Test Firebase Messaging in a browser with unsupported notifications and confirm the app does not blank-screen.
- Test the drawer and modal Escape-key behavior and focus visibility on desktop and mobile.

## Blocked without live credentials or seed data

- Full authenticated navigation sweep.
- Real Firestore rule simulator checks against every role matrix combination.
- Real Storage upload/download checks.
- Push delivery to physical devices.
- Production Vercel cold-start and network timing comparison.

## Regression watch areas

- Staff Roster and permission editing.
- Schedule Builder publish/edit flows.
- Inventory invoice upload and menu scan upload.
- System Administrator forensics/audit views.
- Reminder cron idempotency.
- Founder Beta migration behavior for older restaurants.
