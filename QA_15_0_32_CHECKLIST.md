# QA Checklist - 86 Chaos 15.0.32

## Deployment
- Confirm Vercel build completes successfully.
- Confirm `/version.json` reports `15.0.32`.
- Confirm the app loads to the login screen or dashboard without a blank screen.

## System Administrator Manual
- Log in as a System Administrator.
- Open System Administrator -> Manual.
- Type: `Only I receive push notifications`.
- Confirm the console shows a push-notification playbook, first checks, fix steps, do-not-do warnings, and relevant articles.
- Click a relevant article and confirm it opens inside the article panel without making the whole page endlessly long.
- Click Copy Support Answer and confirm text copies.

## Security Center
- Open System Administrator -> Security Center.
- Confirm the Deletion Requests tile appears.
- Confirm Account Deletion Requests shows an empty state or the current request queue.
- Submit a test deletion request from Account Security on a test account.
- Mark it Reviewing, then Deny or Complete with a note.
- Confirm audit/security records are written.

## MFA Recovery Codes
- Confirm `RECOVERY_CODE_SECRET` is set in Vercel before generating codes.
- Generate recovery codes on a test elevated account.
- Confirm the app refuses recovery-code generation if the secret is missing in a test environment.
- Do not turn on MFA enforcement until recovery has been tested.

## Firebase Rules
- Before publishing rules, confirm your Super Admin account has `superAdmin=true`, `isSuperAdmin=true`, or `systemAccess.superAdmin=true`.
- Publish `firestore.rules` to testing Firestore.
- Publish `storage.rules` to testing Storage.
- Log out and back in.
- Retest System Administrator, login, schedule, inventory, push token save, menu scan, invoice scan, account security, backup status, and restore drill status.

## Production Gate
- Repeat production deploy/rules only after testing passes.
- Do not paste `firebase.json` into Firebase Rules.
- Do not publish hardened rules if no real Super Admin claim/profile flag exists.
