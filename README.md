# 86 Chaos

Current build: 13.1.28

## 13.1.28 focus
- Adds a redundant presence-session heartbeat so Staff Roster and System Administrator live activity do not fall back to stale user-profile timestamps.
- Keeps regular staff roster access read-only while showing more reliable live/last-active status.
- Changes the System Administrator test push message so it clearly says it is only a test and not a published schedule alert.

## Deploy notes
- Deploy through GitHub/Vercel as usual.
- Publish the included `firestore.rules` to the matching Firebase project before testing live presence.
- No Storage rules or Vercel environment changes are required for this build.
