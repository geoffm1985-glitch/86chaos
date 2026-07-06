# 86 Chaos

Current build: 13.1.29

## 13.1.29 focus
- Rebuilds live activity around a stable one-document-per-user `livePresence` heartbeat.
- Keeps Staff Roster and System Administrator Live Activity from falling back to old multi-day timestamps while a user is actively online.
- Adds a small Live Activity debug strip so the admin screen shows whether users are being read and counted as online.

## Deploy notes
- Deploy through GitHub/Vercel as usual.
- Publish the included `firestore.rules` to the matching Firebase project before testing live presence.
- No Storage rules or Vercel environment changes are required for this build.
