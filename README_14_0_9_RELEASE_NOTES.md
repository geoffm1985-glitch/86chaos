# 86 Chaos 14.0.9 Release Notes

## Push Token Repair Center

- Added `/api/push-token-repair` for secure admin push-token repair actions.
- Renamed the System Administrator push area to **Push Token Repair Center**.
- Added per-user actions:
  - Send Test
  - Request Reconnect
  - Force Refresh
  - Copy Reconnect Link
  - Clear Flag
- Added **Prune + Repair Stale** for stale tokens older than 30 days.
- Employee devices now show a reconnect banner when admin queues repair or when they open a reconnect link.
- Reconnect flow refreshes the Firebase Messaging service worker, retrieves a fresh token, saves the token, clears repair flags, and records repair status.
- Firestore rules now allow the logged-in user's own device to update safe push repair fields after reconnecting.
- Admin diagnostics now show push repair status, last push failure code, and last repair error where available.

## Important behavior

An admin cannot create a push token for someone else's phone/computer from the server. The browser/device must open 86 Chaos and complete Firebase Messaging token registration. This build makes that repair path guided, visible, and controllable from System Administrator.
