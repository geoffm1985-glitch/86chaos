# 86 Chaos 15.0.24 Release Notes - Deployment Syntax Fix

## Summary

15.0.24 fixes the failed Vercel build from 15.0.23. The failure was caused by an unescaped apostrophe inside JavaScript release/help text for Account Security. No Firebase behavior, API routes, rules, or environment variables changed.

## Changes

- Fixed Account Security release/help wording so Vercel can compile the app.
- Preserved the 15.0.23 Firebase default verification email flow.
- Preserved password reset targeting the active Firebase Auth email first.

## Deployment impact

- Firestore rules: no changes.
- Storage rules: no changes.
- API routes: no changes.
- Vercel env vars: no new variables.
- Vercel deploy required.
