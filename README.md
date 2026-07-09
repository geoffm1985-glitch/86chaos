# 86 Chaos

Current Version: 15.0.38 - Diagnostics Cleanup and Admin Nav Top Rail

## 15.0.38 focus
- Fixes the System Administrator Health Checks manifest so deployed Vercel API routes are no longer falsely reported as missing.
- Keeps signed Firebase Storage backup download URLs out of diagnostics exports by default.
- Keeps the System Administrator left Admin Menu pinned at the top of the desktop layout instead of letting the Command Deck push it down.
- Adds a Super Admin backup watchdog check button so stale automatic backups can be tested directly from System Administrator.
- Improves Security Diagnostics cron reporting with backup age, scheduled cron stamps, and watchdog status.

## Deploy notes
- Deploy the updated app through Vercel because API routes, `vercel.json`, and frontend code changed.
- Production automatic backups still depend on Vercel Cron invoking `/api/firestore-backup` and `/api/firestore-backup-watchdog` on the production deployment.
- Preview/testing deployments should still use **Run Backup Now** or **Check Watchdog Now** because preview deployments do not receive production cron invocations.
- Firestore rules and Storage rules are unchanged in this version.

## QA quick start
1. Confirm `/version.json` reports `15.0.38`.
2. Open System Administrator on desktop and confirm the left Admin Menu starts at the top of the page.
3. Run System Administrator → Health Checks and confirm the API route manifest no longer reports every route missing.
4. Run Full System Diagnostics and confirm backup objects do not include signed download URLs.
5. Open Backup Center, refresh backups, and confirm the Download button still works.
6. Use **Check Watchdog Now** from the backup card and confirm stale/fresh backup status is reported clearly.
