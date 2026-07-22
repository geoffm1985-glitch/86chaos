# 86 Chaos 15.1.11 Credential Loader Guard

## What changed
- Fixed the Firebase Admin credential loader so the app honors the existing single service-account JSON first.
- Added support for common service-account JSON aliases without requiring a production/preview environment split.
- Hardened `/api/dispatch-reminders` so it never throws the old Firebase Admin setup error into Vercel logs when a cron scope cannot see Admin credentials.
- Kept the 15.1.10 mobile one-column dashboard layout and live-data graph work.

## Notes
- Real reminder push dispatch still uses Firebase Admin when the service-account JSON is available.
- If the service-account JSON is not visible to a specific cron invocation, the route returns a quiet skipped response instead of breaking the app or spamming logs.
