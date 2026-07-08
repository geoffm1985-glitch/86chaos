# 86 Chaos

Current version: 15.0.0

## Build: Kitchen Intelligence, Reminders, and Schedule Clarity

This build keeps the 14.0.10 push-notification and multi-workspace repairs in place, then adds the 15.0.0 kitchen intelligence release work: smarter prep matching, Menu Intelligence, private personal reminders, and schedule views that gray out shifts after they end.

See `README_15_0_0_RELEASE_NOTES.md` and `QA_15_0_0_CHECKLIST.md` for this build.

## Deploy notes

1. Deploy through GitHub/Vercel.
2. Publish the included `firestore.rules` in Firebase Firestore Rules.
3. Publish the included `storage.rules` in Firebase Storage Rules.
4. Confirm `/api/send-push`, `/api/send-schedule-alert`, `/api/push-token-repair`, `/api/scan-menu`, and `/api/dispatch-reminders` are live.
5. Confirm `/version.json` reports `15.0.0` after deploy.
6. If you use separate testing and main Firebase projects, publish the rules to both before testing this build in each environment.

## Firebase/Vercel requirements

The existing Firebase Admin environment variables must remain set in Vercel:

- `FIREBASE_SERVICE_ACCOUNT_KEY` or the split Firebase Admin variables
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `MASTER_ADMIN_EMAIL`

15.0.0 also needs:

- `CRON_SECRET`
- `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`

Vercel Cron only runs on production deployments. The reminder dispatcher is scheduled every five minutes, so the Vercel plan must support that cron cadence and the total number of cron jobs in `vercel.json`.

Push notification token creation still happens on the employee's actual browser/device. Admin repair tools can queue a repair, clear stale records, and copy reconnect links, but they cannot create a browser token without the user's device opening the app.
