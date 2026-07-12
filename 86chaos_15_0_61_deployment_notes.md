# 86 Chaos 15.0.61 Deployment Notes

## Deploy target

Deploy this ZIP to the testing/Vercel preview side first. Confirm `/version.json` reports `15.0.61` before testing the voice workflows.

## Firebase rules

No Firestore or Storage rules changes were made in this release.

If your testing Firebase project already has the 15.0.54+ plan/financial/inventory/menu-intelligence hardening rules deployed, no rules deployment is required for 15.0.61.

## Firebase Functions

No Firebase Functions source behavior changed. The Functions package version metadata was updated to 15.0.61 only.

## Vercel/API routes

The Vercel API routes changed:

- `/api/dispatch-reminders` now advances recurring reminders after successful delivery.
- `/api/voice-command` has safer prompt/intent guardrails for the optional AI parser.

Deploy through the normal Vercel preview/testing workflow so those API routes update with the frontend.

## Environment variables

No new Vercel environment variables are required.

Keep the existing working testing-side setup:

- `FIREBASE_SERVICE_ACCOUNT_KEY` — full Firebase service account JSON.
- `CRON_SECRET` — secret used by cron/reminder dispatch routes.

Do not add a production Firebase key to the testing project just for this release.

## Build cache

If Vercel shows odd stale behavior, redeploy without build cache. This ZIP intentionally does not add a root `package-lock.json`, preserving the deployment shape that worked after the service-account hotfix.

## Placeholders and safety boundaries

86Voice does not implement live POS/accounting integrations, Stripe billing, customer OAuth, or provider secret setup. Integrations remain locked for customers.

86Voice does not auto-approve invoice scans, menu scans, payroll readiness, Daily Close signoff, financial reports, plan/billing changes, Firebase/security/admin settings, or integrations.
