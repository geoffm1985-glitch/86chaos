# QA Checklist - 86 Chaos 15.0.21 Account Security Tab Fix

## Version

- [ ] Confirm `/version.json` shows `15.0.21`.
- [ ] Confirm Settings has visible tabs for Profile, Account Security, Preferences, Alerts, and any permitted workspace/admin settings.

## Account Security visibility

- [ ] On desktop, open Settings and click Account Security.
- [ ] On mobile, open Settings and confirm Account Security is visible without needing to guess or scroll below the Profile form.
- [ ] From Profile, tap Open Account Security and confirm it switches to the Account Security tab.

## MFA smoke test

- [ ] Keep `MFA_ENFORCE_ELEVATED_ROLES=false` during testing.
- [ ] Confirm Account Security shows Role, Enforcement, and Factors cards.
- [ ] Click Refresh Status and confirm it returns a toast instead of crashing.
- [ ] If Firebase SMS MFA is enabled, test sending a setup code with a safe test account before turning enforcement on.

## Regression

- [ ] Reset Password still sends the password reset link from Profile.
- [ ] Preferences, Alerts, Workspace, Branding, and Integrations still open normally for users with permission.
