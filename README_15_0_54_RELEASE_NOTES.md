# 86 Chaos 15.0.54 Release Notes

## Plan gate hardening and Founder Beta completion pass

This update completes and hardens the first 15.0.54 tier / Founder Beta / feature gate implementation without rebuilding the app sideways.

### What changed

- Existing workspaces with no modern subscription data now safely resolve as Founder Beta Smart Kitchen instead of being accidentally locked into Shift.
- New Master Admin-created beta workspaces default to Founder Beta Smart Kitchen and store `selectedFutureTier`.
- The Today/default startup route now remains available on Shift as a basic dashboard/home route. Manager Brief behavior remains Operations+.
- Old active UI/business logic around Starter/Pro/Elite/Enterprise and `appUser.planType` was removed or reduced to migration aliases inside the plan normalizer.
- Firestore subscriptions are more plan-aware so locked routes/features do not subscribe to protected or expensive collections unnecessarily.
- Firestore rules now add plan gates beyond financial collections, including inventory, invoices, vendors, waste logs, reports, exports, menu intelligence scans, and menu dependencies.
- Integrations remain locked for all customer tiers, including Founder Beta, Shift, Operations, Smart Kitchen, and Owner Pro.
- Internal integration screens now clearly treat live credentials as future encrypted server-side vault work and avoid saving raw POS/payroll API keys from the client UI.
- Founder Beta lifecycle details now include beta days remaining, lifecycle flags, extension status, selected future tier, founder price, and discount timing.
- System Administrator plan controls now support safer beta flows: start beta, extend 30 days, end beta to manual active, cancel, and mark active manual.
- A Master Admin Feature Access Resolver diagnostic panel was added for debugging plan + role + manual override decisions.
- Scan usage controls now include a Master Admin reset flow and scan limits continue to enforce before expensive AI calls.
- Plan & Billing UI was polished for owner/admin visibility while keeping staff out of billing controls.
- Custom Roster Roles remain the source of truth for role-based features, reports, filters, scheduling, coverage, exports, and dashboards.
- Help Center, Administrator Manual content, README, and Privacy Policy notes were updated for the current release.

### Important preserved behavior

- Testing Vercel projects can continue using the generic `FIREBASE_SERVICE_ACCOUNT_KEY` full JSON plus `CRON_SECRET`.
- A production Firebase service account key is not required on the testing side.
- This package intentionally keeps the working 15.0.52/15.0.54 hotfix deploy shape: no root `package-lock.json`, no `.npmrc`, no `.node-version`, and no `.nvmrc`.
- No live Stripe billing, POS OAuth, accounting OAuth, customer-facing API key setup, or live integration secret storage was added.
