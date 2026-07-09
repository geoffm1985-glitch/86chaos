# 86 Chaos 15.0.25 Account Repair + Verification Debug

## Summary
This build improves the MFA/email verification setup flow by adding Account Security diagnostics, a safe Firestore profile repair action, and a self-service Firebase verification rescue link.

## Changes
- Account Security now shows the signed-in Firebase Auth UID/email, browser Firebase project, Vercel API/Admin Firebase project, Firestore profile status, Firestore profile email/workspace, MFA factors, and enforcement status.
- Added **Repair My User Profile** when the Auth user exists but `users/{uid}` is missing in Firestore.
- Added **Generate Verification Link** for cases where Firebase Console can send email but the app-triggered verification email does not arrive.
- Added an admin-only **Admin Verify My Email** rescue action for master/system-admin accounts.
- `/api/account-security` now supports explicit `repair-profile`, `generate-verification-link`, and `admin-verify-email-self` actions.
- Account Security warns if the browser Firebase project does not match the Vercel API/Admin Firebase project.

## Deploy notes
- Deploy through GitHub/Vercel.
- No Firestore rules changes.
- No Storage rules changes.
- API route code changed, so Vercel must redeploy.
- No new Vercel environment variables are required.

## MFA testing reminder
Keep MFA enforcement off until an elevated account has verified email, enrolled SMS MFA, logged out, and completed a fresh MFA login.
