# 86 Chaos 13.1.19 Release Notes

## What changed
- System Administrator was reorganized into grouped sections for a cleaner, more professional control-center layout.
- Live Activity now has better recent-user fallback behavior and clearer warnings when Firestore rules or auth claims block the user feed.
- Push notifications now resync the browser FCM token when a user logs in with notifications already allowed.
- Firestore rules now permit safe self-updates for heartbeat and push-token fields while still protecting roles, restaurant routing, and super-admin fields.
- Voice commands now treat “86 item” and “we’re out of item” as an important 86 alert. Inventory counts are not changed by those phrases.
- The Review Stamp workflow now separates creating a stamp from viewing existing review stamps.
- The full-system lockout screen now says the app is down for maintenance instead of showing subscription/billing language.
- Push API routes now accept the existing service-account env patterns and verify that the caller belongs to the workspace or is a Super Admin.

## Files touched
- `src/App.js`
- `src/components/common.jsx`
- `src/features/management.jsx`
- `src/core/appCore.js`
- `api/send-push.js`
- `api/send-schedule-alert.js`
- `api/voice-command.js`
- `firestore.rules`
- `storage.rules`
- `public/version.json`
- `README.md`
