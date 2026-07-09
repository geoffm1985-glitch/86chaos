# 86 Chaos 15.0.38 - Diagnostics Cleanup and Admin Nav Top Rail

## What changed
- Fixed `/api/health-checks` so Vercel serverless packaging no longer causes every API route to show as missing.
- Changed `/api/list-backups` so signed Storage download URLs are only returned when explicitly requested with `includeSignedUrls=1`.
- Redacted signed URLs/secrets from Full System Diagnostics exports as a second safety net.
- Moved the System Administrator desktop left Admin Menu to the top-left grid position so it starts at the top of the admin workspace.
- Added a **Check Watchdog Now** control to the backup status area so Super Admins can manually trigger `/api/firestore-backup-watchdog`.
- Expanded Security Diagnostics cron reporting with backup age, stale status, cron-seen stamps, and watchdog result fields.
- Added a Vercel function config entry for `/api/health-checks`.

## Why
The diagnostics file showed three high-value problems: the API manifest was falsely saying all routes were missing, backup diagnostics were exporting signed download URLs, and automatic backup status was stale. The layout also still let the Command Deck sit above the left menu, which made the menu start too low.

## Separate deploy/publish steps
- Vercel redeploy required: yes, because API routes, `vercel.json`, and frontend layout changed.
- Firestore rules publish required: no.
- Storage rules publish required: no.
- New env vars required: no.
- Existing production env vars still required for automatic backups: `CRON_SECRET`, Firebase Admin credentials, and `FIREBASE_STORAGE_BUCKET` when not using the default bucket.
