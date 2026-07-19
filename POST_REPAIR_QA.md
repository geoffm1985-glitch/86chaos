# 86 Chaos 15.0.90 Post-Repair QA Checklist

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

## Vercel install hotfix checks

- Confirm Vercel logs show `npm ci --omit=optional --no-audit --no-fund --progress=false` instead of default `npm install`.
- Confirm no `requirements.txt does not contain any dependencies` warning appears.
- Confirm no package tarball URL points to an internal audit registry.
- Confirm the Vercel build command uses `NODE_OPTIONS=--max-old-space-size=4096`, disables sourcemaps, and completes the React build.

## 15.0.90 Performance QA Addendum

- Fresh mobile load: confirm the app lands on Today/Home without waiting for Inventory, Invoices, AI Order, Recipes, or System Administrator chunks.
- Inventory Count: confirm initial rows load quickly and **Load full list** appears when the lighter snapshot is active.
- Inventory Search: type at least two characters and confirm the broader inventory snapshot loads.
- Below-Par Focus: confirm the below-par list still works and loads the broader snapshot.
- Inventory sub-tabs: open Order, AI Order, Manage, Vendors, Invoices, and Burn Log. Confirm each sub-tab loads its own data when selected.
- AI Order: confirm suggestions do not calculate on the Count tab and appear after opening AI Order.
- Voice: confirm core navigation still opens Inventory and Recipes, with recipe search loading when needed.
