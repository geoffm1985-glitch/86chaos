# 86 Chaos

Current Version: 15.0.23 - Firebase Email Action Fix

## 15.0.23 focus

15.0.23 fixes the Account Security email-action flow after testing showed Firebase Console password reset emails were delivering, but app-triggered verification/reset links were not reliable in the testing deployment.

## What changed

- Account Security now sends verification email using Firebase's default email action link, matching the console flow.
- Settings password reset now targets the active Firebase Auth email first instead of only the profile email.
- Help Center/release wording now explains the verification flow more clearly.

## Deploy notes

- Deploy through GitHub/Vercel.
- No Firestore rules changes.
- No Storage rules changes.
- No API route changes.
- No new Vercel environment variables.
- Keep MFA enforcement env vars false until one elevated account has verified email, enrolled MFA, and completed a fresh MFA login.

## Post-deploy QA

1. Confirm `/version.json` reports `15.0.23`.
2. Go to Settings > Account Security.
3. Click Send Verification Email.
4. Confirm the Firebase verification email arrives.
5. Click the email verification link.
6. Return to Account Security and click Refresh Email Status.
7. Enroll SMS MFA only after email status is verified.
