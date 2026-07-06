# QA 13.1.25 - Push Admin + Firebase Referrer

## Super Admin Settings Tabs

- Log in as Geoffrm platform Super Admin.
- Open Settings.
- Confirm Workspace is visible.
- Confirm Integrations is visible.
- Log in as a normal non-owner admin.
- Confirm Workspace and Integrations are hidden.

## Push Test

- On the phone, open the production app URL.
- Go to Settings → Alerts.
- Tap Connect Device or Repair Device Push.
- Confirm this device shows as saved.
- On the laptop, open the same production app URL with the same account.
- Go to System Administrator → Platform Operations → Test Push Notifications.
- Confirm the phone receives the notification.

## Firebase Preview Lockout

- Open a Vercel preview URL that is not allowed in Firebase.
- Attempt login.
- Confirm the app displays a friendly Firebase deployment URL/referrer warning instead of only the raw Firebase error.
- Add the preview URL/referrer in Firebase/Google Cloud or use the production app URL.
- Confirm login works after the domain/referrer is allowed.

## Rules/API

- Publish the included firestore.rules.
- Confirm Super Admin can still read/write admin-owned workspace settings.
- Confirm normal employees cannot access owner-only workspace settings.
