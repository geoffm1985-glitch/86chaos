# 86 Chaos

Current Version: 15.0.37 - Gemini Manual and Backup Watchdog

## 15.0.37 focus
This build adds a Gemini-powered System Administrator Manual assistant and hardens automatic backup visibility/reliability with a production fallback watchdog.

## Included
- Adds `/api/gemini-admin-manual` for Super Admin-only Gemini manual answers.
- Adds an Ask Gemini card inside System Administrator → Manual that uses the matched playbook and relevant manual articles.
- Keeps Gemini keys server-side only. The browser calls the app API route, not Google directly.
- Adds `/api/firestore-backup-watchdog` as a production cron fallback. It checks the last successful backup and triggers a catch-up backup only when the backup is stale.
- Adds watchdog route coverage to Health Checks and Vercel route manifest.
- Increases `/api/firestore-backup` function duration/memory in `vercel.json` and stamps cron/watchdog metadata into `system/backupStatus`.
- Clarifies that Vercel Cron only auto-invokes production deployments; Preview/testing still needs Run Backup Now.

## Deploy notes
- Deploy the full ZIP through the normal GitHub/Vercel flow.
- Confirm `/version.json` reports `15.0.37`.
- New API routes require a Vercel redeploy.
- New Vercel cron entry requires production redeploy from `vercel.json`.
- Add `GEMINI_API_KEY` to Vercel if you want the Gemini manual assistant enabled. Optional: set `GEMINI_MODEL`, default is `gemini-3.5-flash`.
- Confirm `CRON_SECRET` is configured in Production so Vercel Cron can call backup routes.
- Optional: set `BACKUP_BASE_URL=https://app.86chaos.com` if the watchdog cannot determine the production host.
- No Firestore rules changes.
- No Storage rules changes.

## QA
Use `QA_15_0_37_CHECKLIST.md` for the current test pass.
