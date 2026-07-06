# 86 Chaos 13.1.25 Release Notes

## Focus

This release repairs the platform-admin identity path and makes Firebase deployment/referrer failures easier to diagnose.

## Changes

- Added the Geoffrm master-admin email alias across the app, Firestore rules, and Vercel API authorization checks.
- Restored Super Admin visibility for Settings → Workspace and Settings → Integrations.
- Kept Workspace and Integrations hidden from normal non-owner admins.
- Updated Firestore bootstrap Super Admin rules to recognize the corrected platform-admin email alias.
- Updated push/admin API routes so test push and admin-only routes recognize the corrected platform-admin email alias even if the older Vercel `MASTER_ADMIN_EMAIL` env var is still present.
- Improved login errors for Firebase referrer / unauthorized-domain failures so preview-domain lockouts point to the actual Firebase allowlist problem.
- Updated version markers to 13.1.25.

## Deployment note

If testing on a Vercel preview URL, Firebase must allow that exact preview domain/referrer or the app should be tested from the production app URL.
