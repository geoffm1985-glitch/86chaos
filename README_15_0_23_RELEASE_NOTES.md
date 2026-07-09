# 86 Chaos 15.0.23 Release Notes

## Firebase Email Action Fix

- Changed Account Security email verification to use Firebase's default action email link instead of passing the current Vercel deployment as a continue URL.
- Updated Settings password reset to send to the currently signed-in Firebase Auth email first, then fall back to the profile email.
- Clarified Account Security wording so users know the email comes from Firebase's default verification system.

## Deployment notes

- Deploy through GitHub/Vercel.
- No Firestore rules changes.
- No Storage rules changes.
- No API route changes.
- No new Vercel environment variables.
- Keep MFA enforcement env vars set to false until at least one elevated account verifies email, enrolls MFA, logs out, and completes a fresh MFA login.
