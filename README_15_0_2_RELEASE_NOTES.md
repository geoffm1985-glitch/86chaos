# 86 Chaos 15.0.2 Release Notes

## Stability and cost-control build

This release keeps the 15.0.1 invoice scanner recovery in place, then hardens the live heartbeat, reminder dispatcher, and scanner upload limits.

## What changed

- Moved high-frequency heartbeat writes out of `users` and `restaurants`; heartbeat writes now stay in `livePresence` and `presenceSessions`.
- Slowed the browser heartbeat interval from 25 seconds to 60 seconds, while still sending immediate updates on focus, visibility, online, pagehide, and beforeunload events.
- Tightened Firestore self-update rules so users can no longer write live heartbeat/session fields onto their main `users/{uid}` profile document.
- Rebuilt `/api/dispatch-reminders` with transaction-based claiming and controlled concurrent delivery instead of one sequential loop.
- Increased `/api/dispatch-reminders` Vercel max duration to 300 seconds for more runway as reminder usage grows.
- Lowered invoice and menu scan upload limits to 20MB in Storage rules, UI checks, and backend API checks.
- Added Storage metadata prechecks before scanner APIs download large files into memory.
- Updated System Administrator documentation, Help Center wording, README, version files, and QA checklist for 15.0.2.

## Deployment notes

- Publish the included `firestore.rules` to Firebase Firestore Rules.
- Publish the included `storage.rules` to Firebase Storage Rules.
- Deploy the app/API routes through Vercel so `vercel.json`, `/api/presence-heartbeat`, `/api/dispatch-reminders`, `/api/scan-invoice`, and `/api/scan-menu` go live.
- No new environment variables are required. Optional tuning variables are `REMINDER_DISPATCH_QUERY_LIMIT`, `REMINDER_DISPATCH_CONCURRENCY`, `INVOICE_SCAN_MAX_PDF_BYTES`, `INVOICE_SCAN_MAX_IMAGE_BYTES`, and `MENU_SCAN_MAX_BYTES`.
