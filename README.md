# 86 Chaos

Current build: 13.1.24

## 13.1.24 focus
- Push notification multi-device repair, production-host Firebase routing, and clearer test push diagnostics.
- System Administrator test push now uses a critical system-test route instead of schedule preferences.
- Workspace and Integrations settings stay owner-level, with platform Super Admin support visibility restored.

## Deploy notes
- Deploy through GitHub/Vercel as usual.
- Publish the included Firestore rules in Firebase for the new safe push-device self-update fields.
- No Storage rules changes are required.
