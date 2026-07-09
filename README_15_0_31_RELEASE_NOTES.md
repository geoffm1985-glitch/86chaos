# 86 Chaos 15.0.31 Release Notes

## App Load Hotfix

- Fixed the startup crash caused by checking `isDemoMode` before it was initialized during the 15.0.30 System Administrator access update.
- Kept the 15.0.30 Super Admin diagnostics and lockout explanation screen.
- Kept the 15.0.29 question-mark explainers, drawer search reset, backup stale warning, and expanded Administrator Manual.

## Deployment

- Vercel redeploy required.
- No Firestore rule changes.
- No Storage rule changes.
- No new Vercel environment variables.
