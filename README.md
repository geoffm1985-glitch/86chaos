# 86 Chaos

Current Version: 15.0.30 - Deployment Access Hotfix

## 15.0.30 focus
- Forced all current version files/metadata to `15.0.30` so deployment mismatch is easier to catch.
- Added a server-backed Super Admin check through `/api/whoami` so the browser can recognize server-configured master admins after login.
- Added a clear System Administrator lockout explanation screen showing the signed-in email, UID, frontend env match, server admin check, master-admin env status, Firebase custom claim status, and Firestore super-admin flag status.
- Added an **Admin Access** diagnostic card inside System Administrator.
- Kept the 15.0.29 question-mark helpers, drawer search cleanup, backup stale warning, and expanded Administrator Manual troubleshooting.
- Fixed a 15.0.29 admin-screen runtime ordering issue by defining browser runtime diagnostics before backup/cron checks use them.

## Super Admin access notes
For testing/preview, make sure these are set in the **Preview** Vercel environment if you want a specific email to open System Administrator:

```env
MASTER_ADMIN_EMAIL=your-admin@example.com
MASTER_ADMIN_EMAILS=your-admin@example.com,backup-admin@example.com
REACT_APP_MASTER_ADMIN_EMAIL=your-admin@example.com
```

`MASTER_ADMIN_EMAIL` and `MASTER_ADMIN_EMAILS` are used by Vercel/API routes. `REACT_APP_MASTER_ADMIN_EMAIL` is baked into the browser bundle and helps the menu show System Administrator immediately. Long-term, prefer Firebase custom claim `superAdmin=true` or Firestore `users/{uid}.isSuperAdmin=true` / `systemAccess.superAdmin=true`.

## Deployment notes
- Deploy through GitHub/Vercel as usual.
- Vercel/API route deployment is needed because `/api/whoami`, `/api/admin-access`, and version metadata changed.
- No Firestore rules changes.
- No Storage rules changes.
- No new required Vercel environment variables, but Super Admin env vars should be configured correctly for Preview and Production.

## QA
Use `QA_15_0_30_CHECKLIST.md` for this build.
