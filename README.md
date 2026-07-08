# 86 Chaos

Current version: **15.0.13**

## 15.0.13 focus

15.0.13 adds shared reminders, Security Center foundations, tighter scanner upload checks, route rate limiting, and the first pass of a cleaner kitchen-first visual system.

## What changed

- **Shared reminders:** My Reminders now has a **Share With** dropdown so a reminder can be assigned to one teammate.
- **Reminder delivery:** due shared reminders dispatch to the assigned teammate’s push token.
- **Reminder rules:** Firestore rules now keep reminders private to the creator and assigned teammate.
- **Security Center:** System Administrator now includes Security Center for rules status, Storage rules status, App Check status, missing env vars, cron status, rate-limit trips, risky elevated users, and suspicious activity.
- **Admin organization:** System Administrator sections are grouped as Security, Deployments, Customers, Diagnostics, Backups, AI Tools, and Audit.
- **Rate limiting:** expensive AI, scan, push, push repair, schedule alert, and reminder routes now have server-side rate-limit protection.
- **Upload protection:** menu and invoice scans check path, file type, size, and upload-purpose metadata before server processing.
- **Storage rules:** menu uploads require `purpose: menu-scan`; invoice uploads require `purpose: invoice-scan`.
- **App Check foundation:** the frontend now reads `REACT_APP_FIREBASE_APPCHECK_SITE_KEY` and sends App Check headers through secure API calls when configured.
- **Professional polish foundation:** added calmer visual-system CSS tokens, mobile tap sizing, loading skeleton style, print-paper style, and consistent status color tokens.
- **Help Center/Admin Manual:** both are updated for 15.0.13.

## Deploy steps

1. Deploy this app through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.13`.
3. Publish the included **Firestore rules**.
4. Publish the included **Storage rules**.
5. Open System Administrator → Security Center and press **Refresh Security Center**.
6. Test shared reminders with two users.
7. Test menu scan and invoice scan uploads.

## Separate publishing required

- **Firestore rules:** yes. Required for shared reminders.
- **Storage rules:** yes. Required for scan-purpose upload checks.
- **Vercel/API routes:** yes. Required for Security Center and route rate limiting.
- **New required env vars:** none.
- **New optional env vars:** see below.

## Optional Vercel env vars

- `REACT_APP_FIREBASE_APPCHECK_SITE_KEY`: Firebase App Check reCAPTCHA Enterprise site key used by the frontend at build time.
- `APP_CHECK_ENFORCE`: set to `true` only after App Check is confirmed working.
- `FIREBASE_APP_CHECK_ENFORCE`: alternate App Check enforcement flag.
- `SCAN_MENU_RATE_LIMIT`: default 8/min per caller.
- `SCAN_INVOICE_RATE_LIMIT`: default 10/min per caller.
- `VOICE_COMMAND_RATE_LIMIT`: default 30/min per caller.
- `PUSH_ROUTE_RATE_LIMIT`: default 40/min per caller.
- `PUSH_REPAIR_RATE_LIMIT`: default 25/min per caller.
- `REMINDER_ROUTE_RATE_LIMIT`: default 12/min for reminder dispatch route.
- `REACT_APP_TEST_FIREBASE_*` and `REACT_APP_PROD_FIREBASE_*`: optional frontend Firebase config overrides for keeping preview/testing and production fully separated.

## Firebase App Check setup

App Check is not finished by code alone. After deploy:

1. In Firebase Console, enable App Check for the testing project first.
2. Register the web app and copy the reCAPTCHA Enterprise site key.
3. Add `REACT_APP_FIREBASE_APPCHECK_SITE_KEY` in Vercel for the matching environment.
4. Redeploy.
5. Open Security Center and confirm App Check status.
6. Turn on Firebase App Check enforcement for Firestore/Storage only after testing passes.
7. Repeat separately for production.

## MFA/two-step setup

The app now identifies elevated users that are missing an MFA flag in Security Center. Actual Firebase MFA enforcement must be configured in Firebase Authentication / Identity Platform policy. Require it for owners, managers, admins, and system admins. Roll it out in testing before production so nobody gets locked out during dinner service.

## Test vs production separation

Keep testing Firebase and production Firebase fully separate:

- separate Firebase projects,
- separate Firestore rules publishes,
- separate Storage rules publishes,
- separate Storage buckets,
- separate service account keys,
- separate Vercel env vars,
- separate App Check keys,
- separate frontend Firebase config env vars for preview/testing vs production.

Do not point a test Vercel deployment at production Firebase unless you are intentionally testing production data.
