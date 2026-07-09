# 86 Chaos

Current Version: 15.0.22 - Email Verification for MFA

## 15.0.22 focus

15.0.22 adds an email verification helper in Settings > Account Security so Firebase SMS MFA enrollment can proceed without needing manual console edits. Firebase requires verified email before enrolling second factors.

## Deploy notes

- Deploy through GitHub/Vercel.
- No Firestore rules changes.
- No Storage rules changes.
- API route update: /api/account-security now reports emailVerified.
- Keep MFA enforcement env vars false until one elevated account has verified email, enrolled MFA, and completed a fresh MFA login.

## Post-deploy QA

1. Confirm `/version.json` reports `15.0.22`.
2. Go to Settings > Account Security.
3. Click Send Verification Email.
4. Click the Firebase email verification link.
5. Return to Account Security and click Refresh Email Status.
6. Enroll SMS MFA only after email status is verified.
