# 86 Chaos

Current Version: 15.0.24 - Deployment Syntax Fix

## 15.0.24 focus

15.0.24 fixes a Vercel build failure caused by a quote/apostrophe syntax issue in the Account Security release wording added in 15.0.23. The Firebase email verification and password reset behavior remains the same as 15.0.23.

## What changed

- Fixed build-blocking JSX/JavaScript wording in Account Security release/help text.
- Kept Account Security verification email on Firebase's default email action link.
- Kept Settings password reset targeting the active Firebase Auth email first.

## Deploy notes

- Deploy through GitHub/Vercel.
- No Firestore rules changes.
- No Storage rules changes.
- No API route changes.
- No new Vercel environment variables.
- Keep MFA enforcement env vars false until one elevated account has verified email, enrolled MFA, and completed a fresh MFA login.

## Post-deploy QA

1. Confirm `/version.json` reports `15.0.24`.
2. Confirm the Vercel build completes successfully.
3. Go to Settings > Account Security.
4. Click Send Verification Email.
5. Confirm the Firebase verification email arrives.
6. Click the email verification link.
7. Return to Account Security and click Refresh Email Status.
8. Enroll SMS MFA only after email status is verified.
