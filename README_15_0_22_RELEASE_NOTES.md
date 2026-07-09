# 86 Chaos 15.0.22 Release Notes

## Email Verification for MFA

- Added a Send Verification Email action inside Settings > Account Security.
- Added a Refresh Email Status action after the user clicks the Firebase verification link.
- Disabled SMS MFA setup until Firebase reports the account email is verified.
- Improved account-security sync so the server reports emailVerified alongside MFA factor status.

## Deployment notes

- Deploy through GitHub/Vercel.
- No Firestore rules changes.
- No Storage rules changes.
- API route changed: /api/account-security now returns email verification state, so Vercel redeploy is required.
- Keep MFA enforcement env vars set to false until at least one elevated account verifies email, enrolls MFA, logs out, and completes a fresh MFA login.
