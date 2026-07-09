# 86 Chaos 15.0.36 - Master Admin Repair Verification

## What changed
- Hardened `/api/master-admin-repair` so it writes `users/{authUid}` and immediately reads it back to verify the Firestore profile exists.
- Added runtime Firebase project reporting to the repair result so testing vs production project mismatches are visible.
- Filtered invalid or placeholder master-admin env values, including `SECOND_ADMIN_EMAIL_HERE`, so one placeholder no longer makes the repair look fully failed.
- Added per-email repair details in System Administrator: document path, verification status, restaurant/workspace target, workspace-member repair status, and row-level errors.
- Updated `/api/whoami` to use the same master-admin env parsing as protected admin routes and report runtime Firebase project details.
- Added workspace membership repair when a real restaurant ID is available.

## Files touched
- api/_chaos-admin.js
- api/master-admin-repair.js
- api/whoami.js
- src/features/management.jsx
- src/core/appCore.js
- api/firestore-backup.js
- api/full-system-diagnostics.js
- api/security-diagnostics.js
- package.json
- public/version.json
- README.md
- QA_15_0_36_CHECKLIST.md

## Deployment notes
- Firestore rules: no changes.
- Storage rules: no changes.
- API routes: redeploy through Vercel so `/api/master-admin-repair` and `/api/whoami` update.
- Vercel env vars: no new required variables. Remove placeholder values from `MASTER_ADMIN_EMAILS` before running repair.
- After a verified repair, log out and back in before publishing hardened Firestore rules.
