# 86 Chaos

Current build: 13.1.22

## 13.1.22 focus

This build adds a stronger System Administrator health and diagnostics layer for safer deployments and backup confidence.

- Added backup integrity verification after Firestore backup uploads, including gzip read-back, metadata validation, document/collection count checks, and SHA-256 checksum stamping.
- Added a System Administrator → Health Dashboard with Firestore latency, backup Storage usage, API response times, backup integrity status, and last successful sync.
- Added one-click Run Full System Diagnostics, which downloads a deployment-readiness JSON report and logs the action.
- Added Administrator Session Timeline in Forensics & Backups so admin/support actions are grouped by session instead of only showing as a flat audit stream.
- Updated Backup Center rows, Command Deck, and Administrator Manual wording to include the new health, diagnostics, and integrity checks.

## Deploy notes

Deploy through the normal GitHub → Vercel flow.

Changed deployable files:

- `api/firestore-backup.js`
- `api/list-backups.js`
- `api/full-system-diagnostics.js`
- `vercel.json`
- React frontend files

No Firestore rules or Storage rules changes are required for this version. Vercel must redeploy the API routes before the new diagnostics and backup verification features are live.
