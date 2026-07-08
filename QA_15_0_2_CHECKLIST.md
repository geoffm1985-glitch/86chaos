# QA Checklist: 86 Chaos 15.0.2

## Deploy verification

- [ ] Deploy through GitHub/Vercel and confirm `/version.json` reports `15.0.2`.
- [ ] Publish the included Firestore rules to the same Firebase project used by the deployed app.
- [ ] Publish the included Storage rules to the same Firebase project used by the deployed app.
- [ ] Confirm Vercel shows `/api/presence-heartbeat`, `/api/dispatch-reminders`, `/api/scan-invoice`, and `/api/scan-menu` as deployed.

## Presence / Live Users

- [ ] Log in as a real user, open the app, and confirm System Administrator → Live Activity or Team shows that user online within roughly one minute.
- [ ] Confirm `livePresence/{workspace_user}` updates while the app is open.
- [ ] Confirm `presenceSessions/{sessionId}` updates while the app is open.
- [ ] Confirm the same heartbeat does not update high-frequency fields on the main `users/{uid}` document.
- [ ] Open the app in two browsers/users and confirm online state still updates without forcing user-profile churn.

## Reminder dispatcher

- [ ] Create a personal reminder scheduled for the next few minutes.
- [ ] Manually call `/api/dispatch-reminders` with `Authorization: Bearer CRON_SECRET` or wait for Vercel Cron in production.
- [ ] Confirm the reminder changes from `scheduled` to `dispatching`, then to `sent`, `no_push_token`, or `delivery_problem`.
- [ ] Confirm the API response includes `limit`, `concurrency`, `scanned`, `claimed`, `sent`, `skipped`, `failed`, and `noToken`.
- [ ] Confirm a second dispatcher run does not send the same reminder twice.

## Invoice and menu scan limits

- [ ] Upload an invoice under 20MB and confirm it scans normally.
- [ ] Try an invoice over 20MB and confirm the app shows a friendly too-large message before or during scan.
- [ ] Upload a Menu Intelligence file under 20MB and confirm it scans normally.
- [ ] Try a menu file over 20MB and confirm the app blocks it with a friendly too-large message.
- [ ] Confirm Firebase Storage rejects oversized files if the browser-side check is bypassed.

## Regression smoke test

- [ ] Confirm Inventory, Prep, Today, Team, Time Clock & Schedule, and Financials still load for the correct workspace.
- [ ] Confirm push repair/reconnect flows still update notification permission and push token fields on the user profile.
- [ ] Confirm demo mode does not show real private customer/employee data.
- [ ] Confirm Help Center stays public-facing and does not expose System Administrator internals.
- [ ] Confirm Administrator Manual contains the 15.0.2 stability/cost-control guidance.
