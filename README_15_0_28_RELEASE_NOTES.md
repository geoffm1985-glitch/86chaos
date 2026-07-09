# 86 Chaos 15.0.28 - Productization Cleanup

## Summary

15.0.28 moves the app closer to a sellable public product by removing hardcoded personal admin fallbacks, adding account deletion request intake, adding restore-drill tracking, and cleaning more internal wording.

## Changes

- Removed hardcoded personal master-admin email fallbacks from app and server routes.
- Added Store-ready Account Deletion Request flow in Account Security.
- Added `/api/account-deletion-request` for authenticated request/cancel actions.
- Added `/api/restore-drill` for System Administrator restore-drill recording.
- Added Restore Drill status to Security Center and System Administrator signal cards.
- Expanded Security Center diagnostics with restore-drill metadata and updated version to 15.0.28.
- Added new API routes to health checks.
- Cleaned visible legacy/internal customer wording where safe without renaming existing data IDs or migration-sensitive files.

## Deployment notes

- Vercel redeploy required for new/changed API routes.
- Firestore rules unchanged.
- Storage rules unchanged.
- Confirm Super Admin access is configured through `MASTER_ADMIN_EMAIL`, `MASTER_ADMIN_EMAILS`, Firebase custom claim `superAdmin`, or Firestore `isSuperAdmin`.
