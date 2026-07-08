# 86 Chaos 15.0.13 Shared Reminders & Security Center

## What changed
- Added shared reminders: My Reminders now includes a **Share With** dropdown so a reminder can be assigned to a selected teammate.
- Shared reminders show whether they are for you, for a teammate, or from a teammate.
- Reminder dispatch now sends the push notification to the assigned teammate, not just the reminder creator.
- Firestore reminder rules now allow creator/assigned-user access without making reminders public to the whole workspace.
- Added a new **System Administrator → Security Center** section.
- Security Center shows Firestore rules status, Storage rules status, App Check status, missing/important Vercel env vars, cron status, rate-limit trips, elevated users missing MFA flags, and suspicious activity from audit logs.
- Reorganized System Administrator sections into Security, Deployments, Customers, Diagnostics, Backups, AI Tools, and Audit.
- Added API rate limiting foundations for scan, AI voice, push, push repair, schedule alert, and reminder-dispatch routes.
- Added stricter scanner upload protection: menu and invoice scan APIs verify path, file type, size, and upload purpose metadata before downloading files.
- Storage rules now require `purpose: menu-scan` for menu uploads and `purpose: invoice-scan` for invoice uploads.
- App Check client support now reads `REACT_APP_FIREBASE_APPCHECK_SITE_KEY` instead of a hard-coded blank value.
- Frontend Firebase config now supports separate `REACT_APP_TEST_FIREBASE_*` and `REACT_APP_PROD_FIREBASE_*` Vercel env overrides while keeping current defaults as fallback.
- Added calmer visual-system CSS foundations for more consistent spacing, mobile controls, skeleton loading, print-paper views, and standard status colors.
- Help Center and Administrator Manual were updated with 15.0.13 instructions and release notes.

## Security setup notes
Some requested security items require outside-console work after deploy:
- Enable Firebase App Check in Firebase Console for both testing and production projects.
- Add `REACT_APP_FIREBASE_APPCHECK_SITE_KEY` to Vercel build env vars.
- Turn on App Check enforcement in Firebase Console after testing.
- Set `APP_CHECK_ENFORCE=true` only after App Check tokens are confirmed in Security Center.
- Configure MFA/two-step enforcement in Firebase Authentication / Identity Platform policy for owner, manager, admin, and system admin accounts.
- Keep test and production Firebase projects fully separate, including service keys, Storage buckets, rules publishes, and Vercel env vars.

## Files changed
- `src/features/intelligence.jsx`
- `src/features/management.jsx`
- `src/components/common.jsx`
- `src/core/appCore.js`
- `src/styles.css`
- `api/security-diagnostics.js`
- `api/_rate-limit.js`
- `api/dispatch-reminders.js`
- `api/scan-menu.js`
- `api/scan-invoice.js`
- `api/voice-command.js`
- `api/send-push.js`
- `api/send-schedule-alert.js`
- `api/push-token-repair.js`
- `firestore.rules`
- `storage.rules`
- `package.json`
- `public/version.json`
- `README.md`

## Deployment notes
Publish Firestore rules and Storage rules after deploying this build. Vercel/API routes must redeploy. New optional env vars are listed in the README.
