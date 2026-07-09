# 86 Chaos

Current Version: 15.0.21 - Account Security Tab Fix

## 15.0.21 focus

15.0.21 makes Account Security / Two-Step Login visible as its own Settings tab and adds a Profile shortcut button so MFA setup is not buried below the profile form on mobile.

## What changed

- Added a visible **Account Security** tab in Settings.
- Added an **Open Account Security** button inside Profile.
- Account Security status refresh now runs when either Profile or Account Security is opened.
- Updated in-app Help/Release Notes wording so users know where MFA enrollment lives.

## Deploy notes

1. Deploy through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.21`.
3. Open Settings and confirm **Account Security** appears as a tab.
4. Keep `MFA_ENFORCE_ELEVATED_ROLES=false` until an owner/super-admin has successfully enrolled and completed a fresh two-step login.

## Separate publishing

- Firestore rules: no changes.
- Storage rules: no changes.
- API routes: no changes.
- Vercel env vars: no new required variables.
