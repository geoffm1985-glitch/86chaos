# 86 Chaos 13.1.32 Release Notes

## Live Presence Session Repair
- The app now waits for Firebase Auth to finish restoring the signed-in browser session before sending a live heartbeat.
- Staff Roster no longer marks the current device as Online Now unless Firebase confirms the heartbeat was actually saved.
- The My Live Presence Check message is now more useful for diagnosing auth-session, API, or Firestore-rule blocks.

## Backup Integrity Reader Repair
- Backup verification now handles both raw gzip backup bytes and readable JSON returned by Firebase/Google Cloud Storage after automatic gzip decompression.
- Full System Diagnostics now recalculates the latest backup integrity from Storage before falling back to older saved backup status.
- Backup restore now reads the same robust format path, avoiding false incorrect-header failures when the backup data is valid.

## Administrator Manual
- Updated System Administrator manual entries for Live Activity troubleshooting, Backup Center, full backup restore, and backup status/integrity checks.

## Deployment Notes
- No Storage rules or Vercel config changes are required.
- No new environment variables are required.
- If Staff Roster still shows permission denied after this version, publish the included Firestore rules to the same Firebase project used by that deployment.
