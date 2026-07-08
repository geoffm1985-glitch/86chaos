# QA Checklist: 86 Chaos 14.0.10 Wiring Audit

## Deploy checks

- [ ] Deploy the ZIP through GitHub/Vercel.
- [ ] Confirm `/api/send-push`, `/api/send-schedule-alert`, and `/api/push-token-repair` are live and auth-protected.
- [ ] Confirm `public/version.json` reports 14.0.10 after deploy.
- [ ] Confirm no new Vercel environment variables are required.

## Push and schedule checks

- [ ] Publish a schedule and confirm active staff receive the schedule notification.
- [ ] Confirm an employee attached through `workspaceMembers` receives alerts for the selected restaurant even if their legacy `users.restaurantId` points elsewhere.
- [ ] Send a normal message-board push and confirm notification preferences are respected.
- [ ] Test a user with Mute on Days Off enabled and confirm the push route no longer fails.
- [ ] Send a Push Control Center test to a single user and confirm only that user's token is targeted.

## Push repair checks

- [ ] Open System Administrator > Push.
- [ ] Use Request Reconnect on a missing-token user and confirm the repair flag appears.
- [ ] Use Force Refresh on a stale-token user and confirm the old token is cleared and repair is queued.
- [ ] Use Prune + Repair Stale for a workspace that includes a multi-workspace employee.
- [ ] Open the app on the employee's own device and confirm Fix Now saves a fresh token and clears the banner.

## Firebase and domain checks

- [ ] On `app.86chaos.com`, confirm the browser Firebase project is `cheers-34b8d`.
- [ ] On `86chaos.com` or `www.86chaos.com`, confirm foreground token creation and background notifications use the production project.
- [ ] On localhost or preview/test hosts, confirm the browser stays on the test Firebase project.
