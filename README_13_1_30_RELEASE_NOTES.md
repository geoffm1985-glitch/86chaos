# 86 Chaos 13.1.30 Release Notes

## Live Activity hard repair
- Added a server-backed presence heartbeat endpoint so regular staff activity no longer depends only on client-side Firestore writes.
- Heartbeats now write the same live status into `livePresence`, `presenceSessions`, the staff user profile, and the restaurant workspace stamp.
- The active user's own Staff Roster row now stays live while their device is actively heartbeating instead of falling back to stale saved timestamps.
- Staff Roster now includes a small My Live Presence Check panel showing whether the current device heartbeat is confirmed or blocked.
- Live presence documents are overwritten with a clean payload so old poisoned presence records cannot keep blocking fresh online status.

## Deployment notes
- New Vercel API route: `api/presence-heartbeat.js`.
- Firestore rules were updated for the presence session payload.
