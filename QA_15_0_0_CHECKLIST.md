# QA Checklist: 86 Chaos 15.0.0

## Deploy checks

- [ ] Deploy the ZIP through GitHub/Vercel.
- [ ] Confirm `/version.json` reports `15.0.0` after deploy.
- [ ] Publish `firestore.rules` to the Firebase project used by this deployment.
- [ ] Publish `storage.rules` to the Firebase project used by this deployment.
- [ ] Confirm Vercel has Firebase Admin variables, `CRON_SECRET`, and `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`.
- [ ] Confirm `/api/send-push`, `/api/send-schedule-alert`, `/api/push-token-repair`, `/api/scan-menu`, and `/api/dispatch-reminders` are live and protected.

## Feature checks

- [ ] Add prep through typing and voice; confirm matching prep items update instead of duplicating when the match is clear.
- [ ] Say or type "slice three tomato", "dice onions", and "3 pans tomatoes"; confirm each opens/updates Prep instead of Help search.
- [ ] Say or type "prep tomatoes for Friday" and "slice three tomato tomorrow"; confirm Prep opens on that day and the item saves to that date.
- [ ] Complete a prep item, then change its quantity; confirm the row keeps history and shows the quantity-changed indicator.
- [ ] Grant Menu Intelligence access from Settings, upload a menu, scan it, review matches, and approve at least one menu dependency.
- [ ] Confirm Menu Intelligence no longer fails with a `gemini-1.5-flash is not found` model error.
- [ ] Set a linked inventory item to zero and confirm Menu Impact appears in Inventory and on the 86 alert text.
- [ ] Create a private reminder from My Reminders and from voice; confirm only that user can read it.
- [ ] Trigger `/api/dispatch-reminders` with the cron secret in a safe test and confirm reminder status updates without sending duplicates.
- [ ] Open My Schedule and Full Schedule with past shifts; confirm ended shifts are gray and future/current shifts still look active.
- [ ] Scan an invoice photo/PDF and confirm Gemini JSON formatting quirks no longer stop the scan at 100%.

## Push and Firebase checks

- [ ] Publish a schedule and confirm active staff receive the schedule notification.
- [ ] Confirm an employee attached through `workspaceMembers` receives alerts for the selected restaurant even if their legacy `users.restaurantId` points elsewhere.
- [ ] Send a normal message-board push and confirm notification preferences are respected.
- [ ] Test a user with Mute on Days Off enabled and confirm the push route does not fail.
- [ ] Open the Push Token Repair Center and confirm Request Reconnect, Force Refresh, and Prune + Repair Stale still work.
