# QA 13.1.24 - Push Multi-Device + Owner Tabs

## Production host sanity
- Test from the same deployed production URL on both laptop and phone.
- Avoid mixing localhost/test/staging on one device with the production app on another while testing push.

## Push setup
- Log in on a phone.
- Open Settings → Alerts.
- Tap Connect Device or Repair Device Push.
- Confirm the status says the browser is allowed and the current device is saved.
- Confirm saved device count is at least 1.

## Same-account multi-device test
- Stay logged in on the phone with notifications allowed.
- Log into the same account on a laptop.
- Open System Administrator → Platform Operations.
- Click Test Push Notifications.
- Confirm the laptop shows a success toast with token count.
- Confirm the phone receives the system test notification.

## Preferences/muting sanity
- Turn Schedule Publications off for the user.
- Run Test Push Notifications again.
- Confirm the critical system-test push still sends because it is a diagnostics test, not a schedule alert.

## Workspace/Integrations access
- Log in as the restaurant account owner and confirm Settings shows Workspace and Integrations.
- Log in as Geoff/platform Super Admin and confirm Settings shows Workspace and Integrations.
- Log in as a normal non-owner admin and confirm Workspace and Integrations are hidden.

## Firebase rules
- Publish firestore.rules.
- Confirm a normal user can update Settings → Alerts without permission errors.
- Confirm a normal non-owner admin cannot write restaurant workspace configuration directly.
