# 86 Chaos 15.0.63 Deployment Notes

## Deploy target

Deploy this ZIP to the testing branch/project first, then production after confirming the Maintenance Mode controls work.

## Firebase rules

No Firestore rules changes were made.

No Storage rules changes were made.

You do not need to publish Firebase rules for this hotfix.

## Vercel environment variables

No new Vercel environment variables are required.

Keep using the existing working setup:

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `CRON_SECRET`

## What to test after deploy

1. Open `/version.json` and confirm `15.0.63`.
2. Log in as Master Admin/System Admin.
3. Open System Administrator → Maintenance Mode Controls.
4. Enable maintenance for one testing workspace.
5. Confirm no `Unsupported field value: undefined` error appears.
6. Clear maintenance.
7. Confirm normal access is restored.

## Production warning

Do not use global maintenance mode on production until you have tested this on a single workspace first.

