# QA Checklist - 86 Chaos 15.0.37

## Deployment
- Confirm `/version.json` reports `15.0.37`.
- Confirm the app loads without a blank screen.
- Confirm System Administrator opens for the configured Super Admin account.
- Confirm Health Dashboard route manifest includes `/api/gemini-admin-manual` and `/api/firestore-backup-watchdog`.

## Gemini System Administrator Manual
- In Vercel, add `GEMINI_API_KEY` to the environment being tested and redeploy.
- Optional: add `GEMINI_MODEL`; leave unset to use the default model.
- Open System Administrator → Manual.
- Type: `Why are automatic backups stale on preview?`
- Click `Ask Gemini`.
- Confirm a structured answer appears with likely cause/check/fix guidance.
- Confirm the answer does not expose API keys, service account JSON, signed backup URLs, or employee/customer records.
- Temporarily test without `GEMINI_API_KEY` in a safe environment and confirm the app shows a clear missing-env error instead of crashing.

## Automatic Backup / Watchdog
- Confirm Production Vercel env has `CRON_SECRET`.
- Confirm `vercel.json` shows `/api/firestore-backup` at `0 9 * * *` and `/api/firestore-backup-watchdog` at `0 21 * * *`.
- On Preview/testing, confirm the System Administrator warning explains that Vercel Cron does not auto-invoke Preview deployments.
- Click `Run Backup Now` in testing and confirm `system/backupStatus` updates with `lastSuccessfulBackupAt`, document count, collection count, and verified integrity.
- On production after deploy, check Vercel Cron logs for `/api/firestore-backup` and confirm `system/backupStatus.cronSeenAt` or `lastScheduledBackupAt` appears after the daily run.
- If the daily cron is intentionally skipped in a safe test, confirm `/api/firestore-backup-watchdog` records `lastWatchdogCheckAt` and runs a catch-up backup only when the last backup is stale.

## Regression checks
- Run Health Dashboard and Full System Diagnostics.
- Confirm `/api/firestore-backup` still supports manual backup and restore mode.
- Confirm Backup Center lists manual and scheduled backups.
- Confirm no Firestore or Storage rules were changed in this ZIP.
