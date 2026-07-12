# 86 Chaos 15.0.54

86 Chaos is a restaurant-management web app built with React, Firebase Auth/Firestore/Storage, Firebase Functions, and Vercel API routes.

## Current release

Version 15.0.54 adds and hardens the centralized tier, Founder Beta, feature gate, scan-limit, and plan access system. Plans now resolve through shared frontend and API helpers instead of scattered hardcoded checks.

Customer-facing plans:

- Shift: $49/month/location
- Operations: $99/month/location
- Smart Kitchen: $179/month/location
- Owner Pro: $299/month/location

Internal-only plan:

- Master Admin/System Admin: not customer-facing. Used for testing, support, plan controls, Founder Beta controls, scan usage reset/review, feature access diagnostics, and integration testing.

## Founder Beta and safe backfill

Founder Beta workspaces use the app free during active beta. The intended beta is 60 days, with one 30-day extension available from Master Admin/System Admin controls. Founder Beta workspaces keep 50% off their selected future tier for 12 months after beta ends.

Existing workspaces with no modern `subscription` object or `planId` do **not** fall back to Shift. They safely resolve as Founder Beta Smart Kitchen until a Master Admin/System Admin manually saves or changes the subscription. This prevents existing testing/customer workspaces from losing access right after deployment.

### Backfill existing workspaces

1. Deploy this ZIP to the testing/preview branch first.
2. Confirm the app loads and System Administrator opens.
3. Open **System Administrator → Workspaces**.
4. Open each existing workspace with **Manage**.
5. If the workspace shows the safe backfill notice, confirm the selected future tier, beta dates, and Founder Beta state.
6. Click **Save** to persist the subscription object.
7. Repeat for testing/Cheers and any active customer/test workspaces.
8. Only after testing, publish the matching Firestore rules to the same Firebase project.

New workspaces created from Master Admin default to Founder Beta Smart Kitchen with `selectedFutureTier: "smart_kitchen"` unless changed.

## Feature access model

Every gated feature should pass both checks:

1. Workspace plan includes the feature.
2. User role/permission allows access.

Master Admin/System Admin bypasses plan locks for testing, but customer integrations remain hidden/locked for customer tiers.

Role-driven features must use the account owner custom Roster Roles from Preferences / Roster Roles as the source of truth. Generic restaurant role names are only fallback labels when a workspace has no configured roster roles.

## AI scan limits

Invoice and menu scan pages are enforced before expensive API/AI calls.

- Shift: 0 invoice pages/month, 0 menu pages/month
- Operations: 20 invoice pages/month, 3 menu pages/month
- Smart Kitchen: 75 invoice pages/month, 10 menu pages/month
- Owner Pro: 200 invoice pages/month, 25 menu pages/month
- Master Admin/internal testing: exempt/unlimited for testing

Invoice/menu scanning itself is gated to Smart Kitchen+. Operations keeps basic inventory and burn log access.

## Integrations

Customer integrations are locked for all customer tiers during rollout. Customers should see the friendly "Integrations are coming soon" message. Do not expose OAuth, API keys, provider setup, or unfinished provider tools to customers.

Internal integration testing screens are Master Admin/System Admin only. Live POS/accounting/payroll secrets should not be stored casually in Firestore. Future live credentials should use a server-side encrypted vault design.

## Deployment notes

Use Vercel preview/testing first. Do not deploy Firestore rules directly to production until owner, manager/admin, staff, Shift, Operations, Smart Kitchen, Owner Pro, Founder Beta, and cross-restaurant access have been tested.

The testing side should continue to work with the existing generic Firebase Admin service account setup:

- `FIREBASE_SERVICE_ACCOUNT_KEY`: full Firebase service account JSON for the testing Firebase project
- `CRON_SECRET`
- Firebase client config variables for the selected environment
- `GEMINI_API_KEY`
- `MASTER_ADMIN_EMAIL` or `MASTER_ADMIN_EMAILS`
- Optional `AI_SCAN_LIMIT_BYPASS_EMAILS`

A production service account key is **not** required for the testing side. Do not bake Firebase service account keys into source files.

This package intentionally does not include a root `package-lock.json`, `.npmrc`, `.node-version`, or `.nvmrc`, preserving the deployment behavior that worked for the testing branch.
