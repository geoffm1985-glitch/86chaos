# 86 Chaos 15.0.58 Website Claim Readiness Table

| Website claim | App support status | File/component/API route involved | QA result | Caveat |
|---|---|---|---|---|
| Prep lists and kitchen tasks | Supported | `src/components/TabPrep.js`, `src/features/operations.jsx`, tab `prep` | Source present; app-shell subscriptions preserved | Plan and role gates apply |
| Inventory | Supported | `src/components/TabInventory.js`, `src/features/operations.jsx`, `firestore.rules` inventory rules | Source present; plan-aware reads hardened | Operations basic inventory, Smart Kitchen advanced cost tools |
| Vendor/invoice workflow | Supported | `src/features/operations.jsx`, `api/scan-invoice.js`, `invoices`, `vendors` | Manager approval path verified in source | Cost/report effects require approval |
| AI-assisted invoice scanning with manager review | Supported | `src/features/operations.jsx`, `api/scan-invoice.js`, `api/_plan-access.js` | Review-first workflow located; scan limits run before expensive call | AI output is not final accounting |
| AI-assisted menu scanning/menu intelligence with manager review | Supported | `src/features/intelligence.jsx`, `api/scan-menu.js`, `menuIntelligenceScans`, `menuDependencies` | Review-first workflow located; approval writes dependency data | Menu impact needs approved setup |
| 86 alerts | Supported | `src/components/common.jsx`, Message Board/Kitchen Command/Manager Brief integration | Source support present | Push depends on valid tokens |
| Menu impact alerts after setup | Supported with setup guidance | `src/features/intelligence.jsx`, `src/components/common.jsx`, `menuDependencies` | Setup requirement documented; dependencies are approval-based | Requires approved menu/inventory links |
| Recipes / recipe book | Supported | `src/components/TabRecipes.js`, tab `recipes` | Source present | Feature gates and permissions apply |
| Reminders | Supported | `src/features/management.jsx`, `api/dispatch-reminders.js` | Source present; cron preserved | Needs `CRON_SECRET` and service account JSON |
| Message Board / team communication | Supported | `src/components/TabMessages.js`, tab `messages` | Source present | Staff-visible content must remain permission appropriate |
| Schedule Builder | Supported | `src/features/schedule.jsx`, `src/components/TabSchedule.js`, `src/components/TabMasterSchedule.js` | Source present; custom-role rule documented | Operations+ and permission required |
| Time Clock | Supported | `src/features/schedule.jsx`, `timePunches` collection/rules | Source present | Browser geolocation permission affects geofence review |
| Labor Command | Supported | `src/features/management.jsx`, `timePunches`, Financial Center labor views | Source present; app-shell labor reads role/plan hardened | Role filters must use custom Roster Roles |
| Daily Close | Supported | `src/features/management.jsx`, `sales`/daily close data | Source present | Operational worksheet, not POS replacement |
| Tip Center | Supported | `src/features/management.jsx`, time punch/tip views | Source present | Wage/tip visibility remains permissioned |
| Financial Center | Supported | `src/features/management.jsx`, `src/hooks/usePlanAccess.js`, `src/components/PlanGate.jsx` | Source present; app-shell financial reads role/plan hardened | Advanced subtabs require Smart Kitchen+ |
| Prime Cost snapshot | Supported | `src/features/management.jsx` | Source present | Snapshot depends on approved/entered data |
| Cost Center / cost visibility | Supported | `src/features/management.jsx`, `src/features/operations.jsx` approved invoices, burn/waste/inventory data | Source present and public language hardened | Not full accounting |
| P&L snapshot | Supported | `src/features/management.jsx` | Source language says operational snapshot, not tax accounting | Not tax-ready bookkeeping |
| Owner-ready reporting/snapshots | Supported | `src/features/management.jsx`, report/export utilities | Source present | Accuracy depends on complete data entry/review |
| Feature and plan gates | Supported | `src/config/plans.js`, `src/lib/featureAccess.js`, `src/hooks/usePlanAccess.js`, `src/components/PlanGate.jsx` | Centralized plan system preserved | Existing no-subscription workspaces default safe Smart Kitchen beta |
| Founder Beta and pricing/tier system | Supported | `src/config/plans.js`, `src/lib/featureAccess.js`, Plan/Billing UI, System Administrator plan tools | Source present | Live payments remain coming soon |
| Integrations locked / coming soon | Supported | Plan gates, Settings/Integrations UI, System Administrator testing access | Customer lock language preserved | No live OAuth/customer API-key setup |

## Readiness summary

The app supports the public website promise when deployed with current rules and tested with correct workspace plan/user permission combinations. The safest public wording remains: AI-assisted, manager review, cost visibility, operational snapshots, and integrations coming soon.
