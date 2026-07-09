# QA Checklist - 86 Chaos 15.0.24 Deployment Syntax Fix

## Build/deploy

- [ ] Push/deploy 15.0.24 to Vercel.
- [ ] Confirm Vercel build finishes successfully.
- [ ] Confirm `/version.json` shows `15.0.24`.

## Account Security

- [ ] Open Settings > Account Security.
- [ ] Confirm the page loads with no blank screen.
- [ ] Click Send Verification Email.
- [ ] Confirm the Firebase verification email arrives.
- [ ] Click the verification link.
- [ ] Return to the app and click Refresh Email Status.
- [ ] Confirm SMS MFA setup is available after email verification.

## MFA safety

- [ ] Confirm `MFA_ENFORCE_ELEVATED_ROLES=false` while testing.
- [ ] Confirm `FIREBASE_MFA_ENFORCE_ELEVATED_ROLES=false` while testing.
- [ ] Confirm `REACT_APP_MFA_ENFORCE_ELEVATED_ROLES=false` while testing.
