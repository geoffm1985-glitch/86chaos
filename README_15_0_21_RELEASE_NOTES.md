# 86 Chaos 15.0.21 Account Security Tab Fix

## Summary

15.0.21 fixes the MFA setup discoverability problem by making Account Security a visible Settings tab and adding a Profile shortcut button.

## Changes

- Added Settings → Account Security as a top-level Settings sub-tab.
- Added an Open Account Security shortcut inside Profile.
- Account Security status refresh now runs when Profile or Account Security is opened.
- Updated Help Center and release note wording for the corrected location.

## Deployment impact

- Firestore rules: unchanged.
- Storage rules: unchanged.
- API routes: unchanged.
- Vercel env vars: unchanged.
