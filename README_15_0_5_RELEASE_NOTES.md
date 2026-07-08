# 86 Chaos 15.0.5 Release Notes

## Manual Presence Snapshot

Version 15.0.5 reduces Firebase read/write churn from online-user tracking.

### What changed

- The main app no longer subscribes to `livePresence` or `presenceSessions`.
- The old repeating browser heartbeat loop was replaced with one low-frequency app-open presence check-in.
- `/api/presence-heartbeat` now writes only the stable `livePresence` document and no longer writes session history.
- Added `/api/presence-snapshot` for a one-time Super Admin-only refresh button in System Administrator → Live.
- Team/Staff Roster no longer shows online/heartbeat status to staff or managers.
- Firestore rules now allow only Super Admins to read presence collections.
- The Administrator Manual explains the new manual snapshot behavior.
- No 15.0.5 release note was added to the public Help Center.

### Deploy notes

- Publish `firestore.rules` after deployment.
- Deploy Vercel/API routes so `/api/presence-snapshot` is available.
- No Storage rules changes are required.
- No new environment variables are required.
