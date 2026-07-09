# 86 Chaos

Current Version: 15.0.33 - Deployment Syntax Hotfix

## 15.0.33 focus
- Fixed the Vercel build failure from 15.0.32.
- The issue was an unclosed JSX wrapper inside System Administrator -> Manual, which caused the compiler error: `Adjacent JSX elements must be wrapped in an enclosing tag`.
- Kept the 15.0.32 AI Support Manual, account deletion review, recovery-code hardening, Super Admin hardening, and production-prep work intact.

## What did not change
- No Firestore rule changes.
- No Storage rule changes.
- No new API routes.
- No new required Vercel environment variables.

## Vercel environment variables
Keep the 15.0.32 environment requirements in place:
- `RECOVERY_CODE_SECRET`: required for MFA recovery codes. Use a random value at least 32 characters long.
- `MASTER_ADMIN_EMAIL` or `MASTER_ADMIN_EMAILS`: server-side System Administrator fallback for API routes.
- `REACT_APP_MASTER_ADMIN_EMAIL`: frontend menu visibility fallback, if you still use it.
- Keep existing Firebase, Gemini, cron, push, and App Check variables exactly as they already are.

## Firebase rules reminder
This hotfix does not change the rule files. If you publish hardened rules from 15.0.32 or later, make sure your own account has one of these first:
- Firebase Auth custom claim `superAdmin=true`
- `users/{yourUid}.isSuperAdmin=true`
- `users/{yourUid}.systemAccess.superAdmin=true`

Vercel env vars can help API routes, but Firebase rules cannot read Vercel env vars.

## Recommended deployment order
1. Upload this source to GitHub.
2. Redeploy the testing/preview Vercel app.
3. Confirm `/version.json` reports `15.0.33`.
4. Confirm the app loads without a Vercel build error or blank screen.
5. Log in as System Administrator.
6. Open System Administrator -> Manual and test the support console.
7. Open System Administrator -> Security Center and confirm the 15.0.32 hardening tools still render.
8. Only after testing passes, repeat deployment on production/main.

## Do not turn on MFA enforcement yet
Keep `MFA_ENFORCE_ELEVATED_ROLES=false` until:
- At least one owner and one System Administrator have enrolled MFA.
- They have logged out and completed a fresh MFA login.
- Recovery codes generate successfully.
- MFA reset/recovery has been tested on a non-critical account.
