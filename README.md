# 86 Chaos

Current version: 15.0.2

86 Chaos is a restaurant/kitchen management web app built with React, Vite-compatible structure, Firebase, and Vercel serverless API routes.

## 15.0.2 focus

This build keeps the 15.0.1 invoice JSON recovery work intact, then adds scale and safety hardening:

- Heartbeats now write only to `livePresence` and `presenceSessions`, not high-churn fields on `users` or `restaurants`.
- Browser heartbeat cadence is reduced from 25 seconds to 60 seconds, with immediate updates still sent on focus/visibility/network/page-exit events.
- Firestore rules now keep user self-updates away from live heartbeat/session fields.
- Reminder dispatching uses transaction-based claiming and controlled concurrency so growing reminder volume is less likely to hit the cron timeout wall.
- The reminder dispatcher Vercel function now has a 300-second max duration.
- Invoice and menu scan uploads are capped at 20MB in Storage rules, UI checks, and backend API checks.
- Scanner APIs inspect Storage metadata before downloading files into memory.

## Deploy steps

1. Deploy the app through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.2` after deploy.
3. Publish `firestore.rules` in Firebase Firestore Rules.
4. Publish `storage.rules` in Firebase Storage Rules.
5. Confirm Vercel has the existing Firebase Admin credentials, `CRON_SECRET`, and a Gemini key (`GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, or `GOOGLE_API_KEY` where applicable).
6. Run the 15.0.2 QA checklist before handing it to staff.

## Required separate publishes

- Firestore rules: yes.
- Storage rules: yes.
- Vercel deploy/API routes: yes.
- New environment variables: no.

Optional tuning variables:

- `REMINDER_DISPATCH_QUERY_LIMIT`
- `REMINDER_DISPATCH_CONCURRENCY`
- `INVOICE_SCAN_MAX_PDF_BYTES`
- `INVOICE_SCAN_MAX_IMAGE_BYTES`
- `MENU_SCAN_MAX_BYTES`

## Branding rule

86 Chaos branding is mandatory and must always remain visible. Restaurant/customer logos may display beside it, but cannot replace or hide 86 Chaos branding.
