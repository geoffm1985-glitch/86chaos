# 86 Chaos 13.1.23 Release Notes

## Push notification repair

- Repaired device push registration so the app saves the active FCM token, browser permission, host, timestamp, and a per-device token record.
- Added a Repair Device Push action in Settings → Alerts for devices that already allowed notifications but need token repair.
- Updated `/api/send-push` and `/api/send-schedule-alert` to support multiple saved device tokens per user.
- Added automatic cleanup for stale/invalid FCM tokens returned by Firebase.
- Added send diagnostics: total users, token count, missing-token count, muted count, failed count, stale tokens removed, and Firebase failure codes.
- Added web-push metadata and notification click handling for better installed-app/PWA behavior.

## Owner-only workspace preferences

- Preferences → Workspace is now visible only to the restaurant account owner.
- Owner-level integrations are also owner-only because they write workspace-level configuration.
- Non-owner admins keep their normal operational permissions but no longer see owner-only workspace controls in Settings.
- Firestore rules continue to protect restaurant workspace updates so frontend hiding and backend protection match.

## Deploy notes

- Publish the included `firestore.rules` after deploying the app.
- Redeploy Vercel so the updated push API routes and service worker are live.
- Have users open Settings → Alerts and press Connect Device or Repair Device Push once after deploy.
