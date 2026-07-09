# QA Checklist - 86 Chaos 15.0.36

## Deployment
- Confirm `/version.json` reports `15.0.36`.
- Confirm the app loads without a blank screen.
- Confirm System Administrator opens for the configured master admin account.

## Master Admin Self-Repair
- In Preview Vercel env vars, confirm `MASTER_ADMIN_EMAIL=geoffm1985@gmail.com`.
- Remove or replace `SECOND_ADMIN_EMAIL_HERE` from `MASTER_ADMIN_EMAILS`; if left in place, confirm the repair UI shows it as skipped rather than failing the whole repair.
- Open System Administrator → Overview → Master Admin Self-Repair.
- Click `Repair Master Admins`.
- Confirm the result shows the runtime Firebase project ID you expect, such as `chaos-test-d1601` for testing.
- Confirm the row for `geoffm1985@gmail.com` shows `created` or `updated` and `Verified: yes`.
- In Firebase Console, open the same project shown in the repair result and confirm `Firestore Database → users → {authUid}` exists.
- Confirm the row shows the exact `users/{authUid}` document path.
- Log out and back in, then confirm System Administrator still opens.

## Regression checks
- Run `/api/whoami` from the app by refreshing System Administrator and confirm Super Admin is recognized.
- Open Security Center diagnostics and confirm admin status still agrees with `/api/whoami`.
- Open Health Dashboard and confirm `/api/master-admin-repair` and `/api/whoami` routes load.
- Confirm no Firestore or Storage rules were changed in this ZIP.
