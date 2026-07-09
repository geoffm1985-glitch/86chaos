# 86 Chaos 15.0.30 Release Notes

## Deployment Access Hotfix

- Forced all current version files and browser/API version metadata to `15.0.30`.
- Added `/api/whoami` Super Admin diagnostics for server master-admin env, Firebase custom claim, and Firestore profile flags.
- The app now promotes the signed-in browser session to Super Admin when `/api/whoami` confirms server-side access.
- Added a detailed System Administrator lockout explanation instead of the generic “page not available” card.
- Added an **Admin Access** diagnostic card inside System Administrator.
- Fixed an admin-screen runtime-order issue where browser runtime diagnostics were used before initialization.
- Kept 15.0.29 System Administrator question-mark explainers, drawer search reset, backup freshness warnings, and expanded Administrator Manual troubleshooting.

## Required deployment

- Vercel deploy required.
- No Firestore rules changes.
- No Storage rules changes.
- No new required env vars, but confirm Super Admin env vars are scoped correctly:
  - `MASTER_ADMIN_EMAIL`
  - `MASTER_ADMIN_EMAILS`
  - `REACT_APP_MASTER_ADMIN_EMAIL`

## Important note

Preview/testing and Production Vercel env vars are separate. If an admin is locked out on the testing URL, check the **Preview** env vars, then redeploy the testing branch.
