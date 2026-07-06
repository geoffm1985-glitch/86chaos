# 86 Chaos

Current build: 13.1.23

## 13.1.23 focus

This build repairs push-notification registration/sending and locks owner-level workspace preferences to the account owner only.

- Push token registration now saves both the current device token and a per-device token map so phone/browser changes are less likely to break notifications.
- Settings → Alerts now includes a Repair Device Push action even when browser permission is already allowed.
- Push API routes now report missing tokens, muted users, failed sends, stale-token cleanup, and failure codes instead of only saying success/failure.
- Schedule and general push routes now clean invalid/stale tokens automatically and send web-push metadata for better installed-app behavior.
- Preferences → Workspace and owner-level integrations now appear only for the restaurant account owner.
- Firestore rules now allow safe user preference/push-token self-updates while keeping restaurant workspace updates owner-only.

## Deploy notes

Deploy through the normal GitHub → Vercel flow.

Changed deployable files:

- `src/App.js`
- `src/core/appCore.js`
- `src/features/management.jsx`
- `src/components/TabSettings.js`
- `api/send-push.js`
- `api/send-schedule-alert.js`
- `public/firebase-messaging-sw.js`
- `firestore.rules`
- `public/version.json`

Firestore rules must be published after deploy. No Storage rules or Vercel env changes are required unless Firebase Admin credentials are missing in Vercel.
