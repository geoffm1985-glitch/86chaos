# 86 Chaos

Current Version: 15.0.28 - Productization Cleanup

## 15.0.28 focus

This build continues the public-readiness pass after MFA recovery: safer Super Admin configuration, account deletion request intake, restore-drill proof, and cleaner customer-facing wording.

## What changed

- Removed hardcoded personal master-admin email fallbacks from frontend and API authorization checks.
- Super Admin access now depends on configured Vercel env vars, Firebase custom claims, or the Firestore `isSuperAdmin`/`systemAccess.superAdmin` flags.
- Added in-app Account Deletion Request intake inside Settings → Account Security.
- Added `/api/account-deletion-request` so users can request/cancel account deletion review without immediately deleting operational records.
- Added `/api/restore-drill` and Security Center restore-drill status so backups can be paired with a monthly safe restore test.
- Added restore-drill tiles/cards to Security Center and System Administrator signals.
- Cleaned more visible legacy/internal labels toward public-product wording.
- Updated Security Center diagnostics, API health manifest, Help Center, README, release notes, and QA checklist.

## Deploy / test notes

1. Deploy this ZIP through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.28`.
3. Confirm at least one Super Admin still has access through `isSuperAdmin`, Firebase custom claim `superAdmin`, or Vercel `MASTER_ADMIN_EMAIL` / `MASTER_ADMIN_EMAILS`.
4. Open Settings → Account Security and submit a test Account Deletion Request. Confirm it creates an `accountDeletionRequests/{uid}` document and a security alert.
5. Cancel the request and confirm the request status changes to `canceled`.
6. Open System Administrator → Security Center and confirm Restore Drill status appears.
7. Record a restore drill after testing a backup restore into a safe/non-production Firebase project.
8. Open System Administrator → Health Dashboard and confirm new API routes appear in the manifest.

## Separate publishing

- Firestore rules: no changes.
- Storage rules: no changes.
- API routes: deploy through Vercel because `/api/account-deletion-request`, `/api/restore-drill`, `/api/security-diagnostics`, and `/api/health-checks` changed.
- Vercel env vars: confirm `MASTER_ADMIN_EMAIL` or `MASTER_ADMIN_EMAILS` is set unless all Super Admins already use Firebase custom claims or Firestore `isSuperAdmin`.
