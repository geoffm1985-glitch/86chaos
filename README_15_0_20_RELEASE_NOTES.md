# 86 Chaos 15.0.20 MFA & Permissions Enforcement

## Summary
15.0.20 adds the Account Security / Two-Step Login foundation for elevated users, an MFA-aware login flow, server-side MFA status sync, elevated-role API enforcement hooks, and a clearer Permissions Preview in System Administrator.

## Included
- Firebase SMS multi-factor sign-in handling on the login screen.
- Settings → Profile Account Security card for SMS MFA enrollment and status sync.
- New `/api/account-security` route that verifies the signed-in user and syncs actual Firebase Auth MFA enrollment status into the user profile.
- MFA enforcement hooks for protected admin API routes that use the shared `_chaos-admin` authorization helper.
- Frontend elevated-role gate routes users to Account Security instead of admin tools when MFA enforcement is turned on before enrollment.
- Security Center now reports MFA enforcement env status and reads actual Firebase Auth MFA enrollment where possible.
- System Administrator → Permission & Role Manager now includes a first-class Permissions Preview panel.
- Health Checks route manifest includes `/api/account-security`.

## Important deployment notes
- Firebase Authentication / Identity Platform SMS MFA must be enabled in Firebase Console before enrollment works.
- Keep `MFA_ENFORCE_ELEVATED_ROLES=false` until at least one owner/super-admin has enrolled and successfully signed in with MFA.
- When ready, set `MFA_ENFORCE_ELEVATED_ROLES=true` in Vercel and redeploy to make supported protected admin API routes require a second-factor sign-in. Use optional `REACT_APP_MFA_ENFORCE_ELEVATED_ROLES=true` only when you also want the frontend gate active from env.
- Firestore rules and Storage rules are unchanged in this build.
