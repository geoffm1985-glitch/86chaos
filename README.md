# 86 Chaos

Current Version: 15.0.20 - MFA & Permissions Enforcement

## 15.0.20 focus

15.0.20 adds Account Security / Two-Step Login enrollment, MFA-aware elevated-role protection, and a clearer Permissions Preview for System Administrator. This build keeps App Check parked while MFA gets tested cleanly.

## What changed

- **MFA login flow:** Firebase SMS multi-factor sign-in challenges are handled on the login screen.
- **Account Security:** Settings → Profile now includes a Two-Step Login enrollment/status panel for owners, managers, admins, and super-admins.
- **Server sync:** Added `/api/account-security` to verify the signed-in user and sync actual Firebase Auth MFA enrollment status into the app profile.
- **Elevated-role enforcement hooks:** Protected admin API routes can require a second-factor sign-in when `MFA_ENFORCE_ELEVATED_ROLES=true`.
- **Frontend safety gate:** If elevated-role MFA enforcement is turned on before enrollment, elevated users are routed to Account Security instead of admin tools.
- **Security Center:** Reports MFA enforcement configuration and elevated accounts missing MFA where possible.
- **Permissions Preview:** System Administrator → Permission & Role Manager now shows allowed screens, blocked screens, and sensitive permission flags.
- **Health manifest:** `/api/account-security` is included in the API route health manifest.

## Deploy steps

1. Deploy this app through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.20`.
3. In Firebase Authentication / Identity Platform, enable SMS Multi-factor Authentication for the same Firebase project.
4. Keep `MFA_ENFORCE_ELEVATED_ROLES=false` while enrolling and testing elevated users.
5. Enroll at least one owner or super-admin through Settings → Profile → Account Security.
6. Log out and sign back in to confirm the two-step login challenge works.
7. Only after testing, set `MFA_ENFORCE_ELEVATED_ROLES=true` in Vercel and redeploy.

## Separate publishing required

- **Firestore rules:** no changes in this release.
- **Storage rules:** no changes in this release.
- **API routes:** yes, deploy through Vercel because `/api/account-security` and protected route MFA guards changed.
- **Vercel environment variables:** add or confirm `MFA_ENFORCE_ELEVATED_ROLES=false` for testing. Optional aliases supported: `FIREBASE_MFA_ENFORCE_ELEVATED_ROLES` and `REACT_APP_MFA_ENFORCE_ELEVATED_ROLES`.
