# 86 Chaos 13.1.22 Release Notes

## System Health & Diagnostics

- Added a new System Administrator → Health Dashboard.
- Added Firestore latency checks, backup Storage usage, API response-time checks, backup integrity status, and last successful sync display.
- Added one-click Run Full System Diagnostics for pre-deployment reporting.
- The diagnostics report downloads as JSON and includes client runtime health plus server-side Firebase/Admin/Storage checks.

## Backup Integrity Verification

- Firestore backups now verify after upload by downloading the saved gzip from Firebase Storage.
- The backup route confirms the file decompresses, validates collection/document counts, checks run metadata, and stamps a SHA-256 checksum.
- Backup status now records `backupIntegrity`, `lastIntegrityStatus`, `lastIntegrityVerifiedAt`, and `backupSha256`.
- Backup Center rows now show the integrity status for each listed backup when available.

## Audit Timeline

- Forensics & Backups now includes Administrator Session Timeline.
- Audit logs are grouped by `sessionId` when available.
- Older logs without session IDs are grouped by actor in 30-minute windows.
- New client audit logs and secure API calls carry the browser session ID forward where possible.

## Administrator Manual

- Updated the internal Administrator Manual with Health Dashboard, full diagnostics, audit session timeline, and backup-integrity instructions.

## Deployment Impact

- Vercel API routes changed and must be redeployed.
- `vercel.json` changed to configure the new full diagnostics route.
- No Firestore rules changes are required.
- No Storage rules changes are required.
- No new environment variables are required, but diagnostics depend on the existing Firebase Admin variables already used by backup routes.
