# 86 Chaos 15.0.3 Release Notes

## Bulk notification cleanup

This release keeps the 15.0.2 heartbeat, reminder, and scanner safety work in place, then fixes the Inventory notification pileup seen after approving multi-row invoice scans.

## What changed

- Added a quiet bulk-save mode for Inventory Safe Writes.
- Invoice scan approval now saves the invoice record, auto-created vendor, newly created inventory items, and stock updates without firing one toast per write.
- Invoice scan approval now shows one final `Invoice Processed` notification with the total saved item count, split into updated and added counts.
- CSV inventory import now suppresses per-row save toasts and shows one final `Upload Complete` item count.
- Single-item Inventory actions still use the normal confirmation toasts.
- Updated System Administrator documentation, Help Center wording, README, version files, and QA checklist for 15.0.3.

## Deployment notes

- Deploy the app/API through Vercel so the updated Inventory workflow is live.
- Firestore rules are unchanged from 15.0.2.
- Storage rules are unchanged from 15.0.2.
- Vercel config is unchanged from 15.0.2.
- No new environment variables are required.
