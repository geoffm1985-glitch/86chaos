# 86 Chaos

Current version: 14.0.9

## Build: Push Token Repair Center

This build adds administrator repair tooling for stale and missing push notification tokens. It preserves the existing React/Vite/Firebase/Vercel structure and adds a secure Vercel API route for push-token repair actions.

See `README_14_0_9_RELEASE_NOTES.md` and `QA_14_0_9_PUSH_TOKEN_REPAIR_CENTER.md` for this build.

## Deploy notes

1. Deploy through GitHub/Vercel.
2. Confirm `/api/push-token-repair` is live.
3. Publish `firestore.rules` because this build allows a user's own device to clear push repair flags after reconnecting.
4. No Storage rule changes are required for this build.

## Firebase/Vercel requirements

The existing Firebase Admin environment variables must remain set in Vercel:

- `FIREBASE_SERVICE_ACCOUNT_KEY` or the split Firebase Admin variables
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `MASTER_ADMIN_EMAIL`

Push notification token creation still happens on the employee's actual browser/device. Admin repair tools can queue a repair, clear stale records, and copy reconnect links, but they cannot create a browser token without the user's device opening the app.
