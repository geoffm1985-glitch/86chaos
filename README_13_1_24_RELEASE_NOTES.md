# 86 Chaos 13.1.24 Release Notes

## Push notifications
- Strengthened push-token repair for multi-device accounts.
- Each device now stores a stable local push device ID along with its FCM token so a laptop login does not hide or overwrite the phone registration.
- Notification setup refreshes the service worker before requesting a token.
- Deployed custom/Vercel domains now use the production Firebase config and production VAPID key by default so browser FCM tokens match the server-side Firebase Admin project. Local/test/staging hosts still use the sandbox config.
- Settings → Alerts now shows saved device count and whether the current device has a saved token.
- System Administrator → Test Push Notifications now uses a critical system test through `/api/send-push` instead of the schedule-publish route, so tests are not muted by schedule preferences, quiet hours, or days-off logic.

## Settings access
- Settings → Workspace and Settings → Integrations remain protected from normal non-owner admins.
- The restaurant account owner can still access them.
- Platform Super Admin support access is restored so Geoff can view/support those tabs.

## Firebase rules
- Added safe self-update fields for push device IDs.
- Publish `firestore.rules` after deploy.
