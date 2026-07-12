# 86 Chaos 15.0.54

86 Chaos is a restaurant-management web app built with React, Firebase Auth/Firestore/Storage, Firebase Functions, and Vercel API routes.

## Current release

Version 15.0.54 adds the centralized tier, Founder Beta, feature gate, and plan access system. Plans now resolve through shared frontend and API helpers instead of scattered hardcoded checks.

Customer-facing plans:

- Shift: $49/month/location
- Operations: $99/month/location
- Smart Kitchen: $179/month/location
- Owner Pro: $299/month/location

Internal-only plan:

- Master Admin/System Admin: not customer-facing. Used for testing, support, plan controls, Founder Beta controls, scan usage reset/review, and integration testing.

## Founder Beta

Founder Beta workspaces use the app free during active beta. The intended beta is 60 days, with one 30-day extension available from Master Admin/System Admin controls. Founder Beta workspaces keep 50% off their selected future tier for 12 months after beta ends.

Existing workspaces with no subscription object safely fall back to Shift so the app does not crash.

## Feature access model

Every gated feature should pass both checks:

1. Workspace plan includes the feature.
2. User role/permission allows access.

Master Admin/System Admin bypasses plan locks for testing, but customer integrations remain hidden/locked for customer tiers.

Role-driven features must use the account owner custom Roster Roles from Preferences / Roster Roles as the source of truth. Generic restaurant role names should only be fallback labels when a workspace has no configured roster roles.

## AI scan limits

Invoice and menu scan pages are enforced before expensive API/AI calls.

- Shift: 0 invoice pages/month, 0 menu pages/month
- Operations: 20 invoice pages/month, 3 menu pages/month
- Smart Kitchen: 75 invoice pages/month, 10 menu pages/month
- Owner Pro: 200 invoice pages/month, 25 menu pages/month
- Master Admin/internal testing: exempt/unlimited for testing

## Integrations

Customer integrations are locked for all customer tiers during rollout. Customers should see the friendly "Integrations are coming soon" message. Do not expose OAuth, API keys, provider setup, or unfinished provider tools to customers.

## Deployment notes

Use Vercel preview/testing first. Do not deploy Firestore rules directly to production until owner, manager/admin, staff, and cross-restaurant access have been tested.

Important Vercel environment variables may include:

- Firebase client config variables for the selected environment
- `FIREBASE_TEST_SERVICE_ACCOUNT_KEY` for Preview/testing API routes
- `FIREBASE_PRODUCTION_SERVICE_ACCOUNT_KEY` for Production API routes
- `CRON_SECRET`
- `GEMINI_API_KEY`
- `MASTER_ADMIN_EMAIL` or `MASTER_ADMIN_EMAILS`
- Optional `AI_SCAN_LIMIT_BYPASS_EMAILS`

Build command is configured in `vercel.json` with Node memory and source-map settings for deployment stability.
