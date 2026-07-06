# QA Checklist: 13.1.23 Push Notifications + Owner Workspace Lock

## Push registration

- Log in as a normal employee on a real phone/browser.
- Open Settings → Alerts.
- Tap Connect Device.
- Confirm the browser/app asks for notification permission if not already allowed.
- Confirm the screen shows Token Saved or a success toast.
- Refresh the app, return to Settings → Alerts, and tap Repair Device Push.
- Confirm no error toast appears.

## Push delivery

- Log in as Super Admin or account owner.
- Open System Administrator → Platform Operations.
- Press Test Push Notifications.
- Confirm the test returns a sent count, or useful counts for missing/muted/failed tokens.
- On the employee device, confirm the notification appears when the app is backgrounded.
- Tap the notification and confirm it opens 86 Chaos.

## Schedule push

- Publish a schedule from Schedule Builder.
- Confirm eligible users with Schedule Publications enabled receive the notification.
- Confirm users with Schedule Publications disabled are counted as muted and do not receive it.

## Owner-only workspace settings

- Log in as the restaurant account owner.
- Open Settings.
- Confirm Workspace appears.
- Confirm workspace settings can be saved.
- Log in as a restaurant admin who is not the owner.
- Open Settings.
- Confirm Workspace does not appear.
- Confirm Integrations does not appear for non-owner admins.

## Rules/security

- Publish `firestore.rules`.
- As a normal user, save Settings → Alerts and confirm it works.
- As a normal user, confirm profile/preference saves still work.
- As a non-owner admin, confirm direct workspace edits are not available from the UI and remain blocked by Firestore rules.
