# 86 Chaos

Current Version: 15.0.36 - Master Admin Repair Verification

## 15.0.36 focus
This build hardens the Master Admin Self-Repair flow so it verifies that `users/{authUid}` was actually written in Firestore and shows the Firebase project the API wrote to.

## Included
- Filters invalid/placeholder `MASTER_ADMIN_EMAIL(S)` values such as `SECOND_ADMIN_EMAIL_HERE` instead of letting them poison the repair result.
- Writes and verifies the Firestore `users/{authUid}` profile after repair.
- Shows the runtime Firebase project ID, verified document path, restaurant/workspace target, and per-email row errors in System Administrator.
- Refreshes `/api/whoami` after repair with a forced token refresh so the app can report whether Super Admin is recognized yet.
- Adds a workspace membership repair when a real restaurant/workspace ID is available.

## Deploy notes
- Deploy the full ZIP through the normal GitHub/Vercel flow.
- Confirm `/version.json` reports `15.0.36`.
- No Firestore rules changes.
- No Storage rules changes.
- No new Vercel environment variables.
- Re-check Preview Vercel env vars and remove placeholder values from `MASTER_ADMIN_EMAILS` before running repair.

## QA
Use `QA_15_0_36_CHECKLIST.md` for the current test pass.
