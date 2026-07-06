# 86 Chaos 13.1.29 Release Notes

## Focus
Live Activity reliability repair.

## Changes
- Added a stable `livePresence` Firestore collection with one live presence document per user.
- Staff Roster and System Administrator Live Activity now merge `livePresence`, `presenceSessions`, and user heartbeat fields.
- Prevented old capped session history from hiding currently online users.
- Added a small Live Activity debug strip showing user count, online count, live window, and presence sources.
- Updated Firestore rules so users can write only their own `livePresence/{uid}` heartbeat document and tenant peers/admins can read safe live status.

## Deployment note
Publish the included `firestore.rules` to the same Firebase project used by the Vercel Preview deployment before testing Live Activity.
