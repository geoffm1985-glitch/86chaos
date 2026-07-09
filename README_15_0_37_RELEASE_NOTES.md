# 86 Chaos 15.0.37 - Gemini Manual and Backup Watchdog

## What changed
- Added `/api/gemini-admin-manual`, a Super Admin-only route that asks Gemini for a practical answer using only the matched System Administrator playbook/manual context sent by the app.
- Added an Ask Gemini panel in System Administrator → Manual with answer display, copy button, model/API metadata, and clear error messages when Gemini env vars are missing.
- Added `/api/firestore-backup-watchdog`, a production cron fallback that checks backup freshness and triggers `/api/firestore-backup` only when the last successful backup is stale.
- Added the watchdog cron entry at `0 21 * * *`, while keeping the main daily backup at `0 9 * * *`.
- Increased `/api/firestore-backup` max duration/memory in `vercel.json` and stamps cron schedule headers, watchdog headers, host, and source into backup metadata/status.
- Updated Health Checks route manifest so Gemini manual and backup watchdog appear in System Administrator health diagnostics.
- Updated Administrator Manual troubleshooting notes for Preview/testing cron behavior and production backup verification.

## Files touched
- api/gemini-admin-manual.js
- api/firestore-backup-watchdog.js
- api/firestore-backup.js
- api/health-checks.js
- src/features/management.jsx
- src/core/appCore.js
- api/full-system-diagnostics.js
- api/master-admin-repair.js
- api/security-diagnostics.js
- api/whoami.js
- vercel.json
- package.json
- public/version.json
- README.md
- README_15_0_37_RELEASE_NOTES.md
- QA_15_0_37_CHECKLIST.md

## Deployment notes
- Firestore rules: no changes.
- Storage rules: no changes.
- API routes: redeploy through Vercel.
- Vercel config: changed. Deploy the updated `vercel.json` so the watchdog cron and function limits take effect.
- New env var for Gemini manual assistant: `GEMINI_API_KEY`.
- Optional Gemini env var: `GEMINI_MODEL`.
- Existing backup env var still required: `CRON_SECRET`.
- Optional backup env var: `BACKUP_BASE_URL=https://app.86chaos.com`.
- Automatic Vercel Cron invokes production deployments. Preview/testing deployments still need manual backup tests.
