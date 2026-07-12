# 86 Chaos 15.0.58

86 Chaos is a restaurant operations platform for kitchens, bars, and multi-role restaurant teams. It uses React, Firebase Auth/Firestore/Storage, Vercel API routes, and Firebase Functions.

Version **15.0.58** is a website-claims readiness hardening pass. It preserves the 15.0.57 desktop polish, 15.0.56 restaurant-group push broadcasting, and 15.0.54 tier / Founder Beta / feature gate system while tightening feature wiring, plan-aware reads, permission safety, Help Center wording, Administrator Manual notes, and QA coverage against the public website promises.

## What changed in 15.0.58

- Audited the app against the public promise that 86 Chaos connects prep, inventory, schedules, 86 alerts, recipes, reminders, labor, daily close, cost visibility, menu impact alerts, team communication, and owner-ready snapshots.
- Hardened app-shell Firestore subscriptions so restricted financial, labor, inventory, Menu Intelligence, and COGS collections are not subscribed to when the current user/plan cannot access them.
- Preserved the centralized tier, Founder Beta, feature gate, and integration-lock system.
- Confirmed invoice scanning remains AI-assisted and manager-review-first before inventory, vendor spend, COGS, reports, or cost visibility are updated.
- Confirmed menu scanning remains AI-assisted and manager-review-first before Menu Impact Alert dependency data is created.
- Added customer-facing Help Center wording explaining setup requirements, manager review, operational snapshots, cost visibility, and integrations coming soon.
- Added Administrator Manual guidance for website-claim readiness, plan-aware data reads, roster-role source-of-truth rules, and safe marketing language.
- Cleaned Staff Roster role defaults so active UI logic no longer prefers a hardcoded role name; owner-managed Roster Roles remain the source of truth with generic fallbacks only when empty.
- Kept all existing tabs, routes, workflows, permissions, admin tools, reports, API routes, Firebase rules, documents, and UI sections intact.

## Deployment notes

This pass does not add new Vercel environment variables. It keeps the working testing-side Firebase Admin setup based on the full JSON service account in `FIREBASE_SERVICE_ACCOUNT_KEY` plus `CRON_SECRET`.

No new Firebase or Storage rule changes were made in this pass compared with 15.0.57. If a target environment is behind the 15.0.54+ rules, deploy the latest included `firestore.rules` and `storage.rules` to the testing project before validating feature gates and plan-sensitive collections.

Testing should still verify the Vercel Preview app on a real desktop/laptop monitor and phone-width viewport before promoting to production.
