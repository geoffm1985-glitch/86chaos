# QA Checklist: 15.1.11 Credential Loader Guard

- [ ] Deploy without adding any new Vercel environment variables.
- [ ] Confirm `/api/dispatch-reminders` no longer logs the old Firebase Admin credential setup failure.
- [ ] Confirm the app loads normally on mobile and desktop.
- [ ] Confirm reminders still dispatch when the existing service-account key is visible to the server route.
- [ ] Confirm unauthorized requests to `/api/dispatch-reminders` still return unauthorized without the cron secret.
- [ ] Confirm Today, Schedule, Prep, Inventory, Recipes, Financials, Settings, and System Administrator still render.
