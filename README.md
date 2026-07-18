# 86 Chaos

86 Chaos is a restaurant/kitchen management web app built with React, Vite/Create React App tooling, Firebase Auth/Firestore/Storage, and Vercel API routes.

## Current build

Version: 15.0.65

This build focuses on voice reminder deduplication, request-off lifecycle cleanup, employee availability, reminder attention handling, Event Calendar push/order reminders, Brother QL-810W prep label printing, notification dedupe, and the reordered main menu.

## Important operational notes

- Use the account owner’s custom Preferences / Roster Roles as the source of truth anywhere role-based scheduling, labor, filters, permissions, exports, or reports are shown.
- Request-off records are no longer hard-deleted by normal user workflows. They are cancelled, processed, archived, and restorable for dispute/audit history.
- Availability records are separate from request-off records and are used by Schedule Builder as warnings, not hard blocks.
- Event reminders and order reminders are dispatched by the existing `/api/dispatch-reminders` cron flow.
- Prep label print CSS is intended for a Brother QL-810W profile and hides app chrome during print.

## Deploy checklist

1. Deploy Firestore rules after testing.
2. Deploy Vercel API routes so `/api/dispatch-reminders` can dispatch event and order reminders.
3. Confirm `CRON_SECRET` is configured for the reminder dispatch route.
4. Confirm the existing reminder cron still calls `/api/dispatch-reminders` on schedule.
5. Run QA from `QA_CHECKLIST_15.0.65.md` before promoting to production.
