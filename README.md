# 86 Chaos

Current version: 14.0.10

## Build: Push, Schedule Alert, and Firebase Wiring Audit

This build repairs push notification and schedule alert wiring while preserving the existing React/Firebase/Vercel structure. It keeps the Push Token Repair Center in place, fixes a push-route crash, and makes push, schedule alert, and repair routes respect canonical multi-workspace staff memberships.

See `README_14_0_10_RELEASE_NOTES.md` and `QA_14_0_10_WIRING_AUDIT.md` for this build.

## Deploy notes

1. Deploy through GitHub/Vercel.
2. Confirm `/api/send-push`, `/api/send-schedule-alert`, and `/api/push-token-repair` are live.
3. Publish `firestore.rules` if the currently deployed Firebase project does not already have the 14.0.9 push repair self-update fields.
4. No Storage rule changes are required for this build.

## Firebase/Vercel requirements

The existing Firebase Admin environment variables must remain set in Vercel:

- `FIREBASE_SERVICE_ACCOUNT_KEY` or the split Firebase Admin variables
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `MASTER_ADMIN_EMAIL`

Push notification token creation still happens on the employee's actual browser/device. Admin repair tools can queue a repair, clear stale records, and copy reconnect links, but they cannot create a browser token without the user's device opening the app.
