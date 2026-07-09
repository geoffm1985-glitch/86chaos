# QA Checklist - 86 Chaos 15.0.28

## Version

- [ ] Deploy to testing.
- [ ] Confirm `/version.json` shows `15.0.28`.
- [ ] Confirm System Administrator access still works for a known Super Admin.

## Super Admin configuration

- [ ] Confirm no public flow depends on a hardcoded personal email.
- [ ] Confirm `MASTER_ADMIN_EMAIL` or `MASTER_ADMIN_EMAILS` is set in Vercel if needed.
- [ ] Confirm a Firestore `isSuperAdmin` or Firebase `superAdmin` claim user can open System Administrator.

## Account deletion request

- [ ] Open Settings → Account Security.
- [ ] Submit a test Account Deletion Request.
- [ ] Confirm `accountDeletionRequests/{uid}` is created with status `requested`.
- [ ] Confirm a `securityAlerts` record is created.
- [ ] Cancel the request and confirm status becomes `canceled`.

## Restore drill

- [ ] Open System Administrator → Security Center.
- [ ] Confirm Restore Drill tile/card is visible.
- [ ] Record a planned drill.
- [ ] Confirm `system/restoreDrillStatus` updates.
- [ ] After a real safe restore into a test project, record the drill as `passed`.

## Security Center / Health

- [ ] Refresh Security Center and confirm version, backup, restore drill, App Check, MFA, rules, env vars, and risky users load.
- [ ] Open Health Dashboard and confirm `/api/account-deletion-request` and `/api/restore-drill` appear ready.

## Regression

- [ ] Login works for a normal employee.
- [ ] Login works for manager/admin.
- [ ] MFA Account Security still shows enrolled status.
- [ ] Recovery codes still generate/use correctly.
- [ ] Backup list and manual backup still load.
