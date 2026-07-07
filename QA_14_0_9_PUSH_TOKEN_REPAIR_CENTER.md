# QA Checklist: 86 Chaos 14.0.9 Push Token Repair Center

## Deploy checks

- [ ] Deploy the ZIP through GitHub/Vercel.
- [ ] Confirm `/api/push-token-repair` returns auth-protected responses.
- [ ] Publish the included `firestore.rules`.
- [ ] Confirm existing push route `/api/send-push` still works.

## Admin repair checks

- [ ] Open System Administrator → Push.
- [ ] Confirm the page title says Push Token Repair Center.
- [ ] Confirm each user row shows Permission, Last Sync, Host, Result, and repair status when present.
- [ ] Click Request Reconnect on a missing-token user and confirm a repair queued badge appears.
- [ ] Click Force Refresh on a stale-token user and confirm their token is cleared/repair is queued.
- [ ] Click Copy Link and confirm the reconnect URL copies to clipboard.
- [ ] Click Prune + Repair Stale and confirm stale tokens are cleared and marked for repair.
- [ ] Click Clear Flag and confirm queued repair state is cleared without deleting the user.

## Employee-device checks

- [ ] Open the app as a user marked for repair.
- [ ] Confirm a yellow reconnect notifications banner appears.
- [ ] Tap Fix Now.
- [ ] If browser notification permission is default, confirm the browser asks for permission.
- [ ] If permission is granted, confirm the app saves a fresh FCM token and clears the repair banner.
- [ ] Return to System Administrator → Push and confirm the user's result is no longer missing/stale.
- [ ] Send a test push to that user.

## Edge cases

- [ ] Browser permission denied: app should explain that permission must be changed in browser/device settings.
- [ ] Stale token with old host: Force Refresh should queue a service-worker/token refresh on next app open.
- [ ] Missing token but permission granted: Request Reconnect should still show a repair prompt when the user opens the app.
- [ ] Demo mode: repair banner and switching should not expose real employee private info.
