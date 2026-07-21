# QA Checklist - 15.0.98 Push Duplicate Browser Token Hotfix

## Desktop/browser duplicate verification
- [ ] Deploy 15.0.98 to the test preview.
- [ ] Open the app once on the desktop browser that previously duplicated notifications.
- [ ] Confirm the footer shows Version 15.0.98.
- [ ] Allow notifications if prompted.
- [ ] Trigger one personal reminder push.
- [ ] Confirm only one desktop notification appears.
- [ ] Trigger one Android reminder push.
- [ ] Confirm only one Android notification appears.

## Token behavior
- [ ] Confirm the user document has the newest `fcmToken`.
- [ ] Confirm reminder dispatch still sends when `fcmToken` exists.
- [ ] Confirm legacy token fields do not cause extra duplicate reminder pushes.
- [ ] Confirm a user with no `fcmToken` can still fall back to legacy saved tokens if present.

## Regression
- [ ] Schedule alert push still sends.
- [ ] Message/announcement push still sends.
- [ ] Account security push still sends.
- [ ] Bug report owner/admin alert still sends.
- [ ] Push Control Center test push still sends.
