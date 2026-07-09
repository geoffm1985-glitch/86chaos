# 86 Chaos

Current Version: 15.0.31 - App Load Hotfix

## 15.0.31 focus
- Fixed a startup crash introduced during the 15.0.30 System Administrator access hotfix.
- Preserved 15.0.30 admin access diagnostics, /api/whoami, lockout explanation screen, and Admin Access card.
- Preserved 15.0.29 System Administrator question-mark helpers, drawer search cleanup, backup stale warning, and expanded Administrator Manual.

## Deploy notes
- Deploy through GitHub/Vercel as usual.
- Confirm /version.json reports 15.0.31 after deployment.
- If System Administrator access is blocked, confirm MASTER_ADMIN_EMAIL / MASTER_ADMIN_EMAILS are set in the correct Vercel environment.

## Separate publishing
- Firestore rules: no changes.
- Storage rules: no changes.
- API routes: no new route changes, but Vercel redeploy is required.
- Vercel env vars: no new required variables.
