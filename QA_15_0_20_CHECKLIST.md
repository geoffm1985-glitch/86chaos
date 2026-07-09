# QA Checklist - 86 Chaos 15.0.20 MFA & Permissions Enforcement

## Before enforcing MFA
- [ ] Deploy the app to testing/preview.
- [ ] Confirm `/version.json` shows `15.0.20`.
- [ ] In Firebase Console, enable SMS Multi-factor Authentication for the same Firebase project as the testing deployment.
- [ ] Confirm `MFA_ENFORCE_ELEVATED_ROLES=false` in Vercel while testing enrollment.

## Account Security enrollment
- [ ] Log in as an owner, manager, admin, or super-admin.
- [ ] Open Settings → Profile.
- [ ] In Account Security, click Refresh Status.
- [ ] Enter current password and a phone number in E.164 format, such as `+19205551234`.
- [ ] Click Send Setup Code.
- [ ] Enter the SMS code and click Confirm Two-Step Login.
- [ ] Confirm the card shows MFA enabled / enrolled.
- [ ] Log out and log back in.
- [ ] Confirm the login screen asks for a two-step login code.
- [ ] Confirm login finishes after the code is verified.

## Enforcement smoke test
- [ ] Keep a known enrolled super-admin account available before enabling enforcement.
- [ ] Set `MFA_ENFORCE_ELEVATED_ROLES=true` only after enrollment/sign-in works.
- [ ] Redeploy Vercel after changing env vars.
- [ ] Log in with the enrolled super-admin and open System Administrator → Health Dashboard.
- [ ] Confirm `/api/account-security` appears in the health route manifest.
- [ ] Confirm protected admin routes still work after MFA sign-in.
- [ ] Confirm a non-MFA elevated account is reported in Security Center as risky.
- [ ] With frontend enforcement enabled, confirm a non-enrolled elevated account is routed to Account Security instead of admin tools.

## Permissions Preview
- [ ] Open System Administrator → Permission & Role Manager.
- [ ] Select a workspace/user in Permissions Preview.
- [ ] Confirm allowed and blocked screens are listed.
- [ ] Confirm sensitive permissions show wage visibility/editing, backups, forensics, and demo privacy status.

## Regression checks
- [ ] Staff without elevated roles can still log in normally.
- [ ] Password reset still sends a reset email.
- [ ] Existing workspace switcher still appears for users with multiple restaurants.
- [ ] App Check remains disabled until separately finished.
