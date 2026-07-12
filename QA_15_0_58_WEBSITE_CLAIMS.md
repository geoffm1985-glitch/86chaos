# QA 15.0.58 Website Claims Readiness

Use this checklist on the Vercel testing/preview deployment before production promotion.

## Global preservation checks

- [ ] App opens on desktop and mobile width without console crashes.
- [ ] Time Clock still opens and saves expected punch workflows.
- [ ] Schedule Builder still opens for permitted Operations+ users.
- [ ] Financial Center still opens for permitted users and locks for staff/locked plans.
- [ ] Inventory still opens for permitted users.
- [ ] Invoice scanning still opens only on included plans and permission sets.
- [ ] Menu Intelligence still opens only on included plans and permission sets.
- [ ] Recipes still open for included plans and permitted users.
- [ ] Prep lists still open and save tasks.
- [ ] Message Board still opens and posts messages/86 alerts.
- [ ] Reminders still open and save reminders.
- [ ] Push Notification Center still supports workspace and restaurant-group targeting for System Administrator.
- [ ] System Administrator, Security Center, Backup Center, Plan/Billing, Help Center, Administrator Manual, Voice Commands, Staff Roster, Workspace Settings, custom Roster Roles, and Demo Mode remain present.

## Plan, permission, and direct URL checks

- [ ] Shift workspace does not subscribe to or display locked Operations/Smart Kitchen financial, labor, invoice scan, menu scan, COGS, or Menu Intelligence collections.
- [ ] Operations workspace can access Schedule Builder, Time Clock, Labor Command, Daily Close, Sales Breakdown, Tip Center, basic inventory, burn log, and basic reports when role permissions allow it.
- [ ] Smart Kitchen workspace can access Financial Overview, Prime Cost, Cost Center, invoice scanning, menu scanning, Menu Intelligence, P&L Snapshot, Budget & Targets, advanced reports, and menu impact tools when role permissions allow it.
- [ ] Owner Pro workspace includes Smart Kitchen features plus owner/advanced placeholders where present.
- [ ] Founder Beta Smart Kitchen workspace keeps Smart Kitchen access during active beta.
- [ ] Existing workspace with no subscription data safely defaults to Founder Beta Smart Kitchen behavior until manually backfilled.
- [ ] Master Admin/System Admin can test/bypass plan locks where appropriate.
- [ ] Normal staff cannot access restricted financial, wage, owner, admin, integration, or plan controls.
- [ ] Direct URL access to locked routes shows a clean locked/unavailable screen or redirects safely.

## Website claim mapping checks

| Claim | App support status | Main files/routes | QA result | Caveat |
|---|---|---|---|---|
| Prep lists and kitchen tasks | Supported | `src/components/TabPrep.js`, `src/features/operations.jsx`, app tab `prep` | Verify add/edit/complete task and Today/Kitchen Command visibility | Plan/permission gates still apply |
| Inventory | Supported | `src/components/TabInventory.js`, `src/features/operations.jsx`, tab `inventory`, `firestore.rules` inventory rules | Verify item/par/vendor/burn workflows | Operations gets basic inventory; Smart Kitchen gets deeper cost tools |
| Vendor/invoice workflow | Supported | `src/features/operations.jsx`, `api/scan-invoice.js`, collections `invoices`, `vendors` | Verify invoice history and vendor spend after approval | Cost effects require manager approval |
| AI-assisted invoice scanning with manager review | Supported | `src/features/operations.jsx`, `api/scan-invoice.js`, `api/_plan-access.js` | Verify scan limit blocks before API call, scan opens review, approval required | AI output is helper data, not auto-posted accounting |
| AI-assisted menu scanning/menu intelligence with manager review | Supported | `src/features/intelligence.jsx`, `api/scan-menu.js`, collections `menuIntelligenceScans`, `menuDependencies` | Verify scan review and approval before dependencies are saved | Menu impact requires approved dependencies |
| 86 alerts | Supported | `src/components/common.jsx`, Message Board, Manager Brief/Kitchen Command hooks | Verify alert creation and message board visibility | Push delivery depends on token health |
| Menu impact alerts after setup | Supported with setup guidance | `src/features/intelligence.jsx`, `src/components/common.jsx`, dependency collections | Verify affected menu items appear when dependencies exist; verify setup message when missing | Needs approved Menu Intelligence links and inventory items |
| Recipes / recipe book | Supported | `src/components/TabRecipes.js`, app tab `recipes` | Verify recipe create/edit/search and voice open-by-name | Plan/permission gates apply |
| Reminders | Supported | `src/features/management.jsx`, reminder APIs/collections | Verify personal/shared reminders and dispatch route | Cron requires `CRON_SECRET` and Firebase service account JSON |
| Message Board / team communication | Supported | `src/components/TabMessages.js`, app tab `messages` | Verify posts, important messages, read states where present | Staff sees team-appropriate content only |
| Schedule Builder | Supported | `src/features/schedule.jsx`, `src/components/TabSchedule.js`, `src/components/TabMasterSchedule.js` | Verify builder, publish, coverage, custom Roster Roles | Operations+ and permission required |
| Time Clock | Supported | `src/features/schedule.jsx`, time punch collections | Verify clock in/out, geofence review, punch warnings | Location behavior depends browser permission |
| Labor Command | Supported | `src/features/management.jsx`, Financial Center labor subtabs, `timePunches` rules | Verify missed punches, long shifts, overtime risk, payroll readiness, exports | Role reports must use custom Roster Roles |
| Daily Close | Supported | `src/features/management.jsx`, `sales` / close data | Verify save feeds Financial Center and audit logs meaningful changes | Operational close worksheet, not POS replacement |
| Tip Center | Supported | `src/features/management.jsx`, `timePunches` / tips | Verify cash/credit tips and exports | Wage/tip visibility remains permissioned |
| Financial Center | Supported | `src/features/management.jsx`, plan gates, financial rules | Verify Overview, Daily Close, Sales, Labor, Tips, COGS, Expenses, P&L, Targets, Reports | Smart Kitchen+ for advanced subtabs |
| Prime Cost snapshot | Supported | `src/features/management.jsx` | Verify labor + food/bev cost math and target coloring | Snapshot based on entered/approved data |
| Cost Center / cost visibility | Supported | `src/features/management.jsx`, `src/features/operations.jsx` approved invoices, waste/burn/inventory data | Verify approved invoices/vendor spend/burn data feed cost views | Not full accounting |
| P&L snapshot | Supported | `src/features/management.jsx` | Verify P&L language says operational snapshot | Not tax-ready bookkeeping |
| Owner-ready reporting/snapshots | Supported | `src/features/management.jsx`, report/export utilities | Verify print/CSV owner report outputs | Accuracy depends data entry/review |
| Feature and plan gates | Supported | `src/config/plans.js`, `src/lib/featureAccess.js`, `src/hooks/usePlanAccess.js`, `src/components/PlanGate.jsx` | Verify each tier and direct URL lock behavior | Existing no-subscription workspaces default safe Smart Kitchen beta |
| Founder Beta and pricing/tier system | Supported | `src/config/plans.js`, `src/lib/featureAccess.js`, Plan/Billing UI, System Administrator controls | Verify beta dates, extension, founder discount, selected future tier | Payments remain coming soon |
| Integrations locked / coming soon | Supported | Plan gates, Settings/Integrations UI, System Administrator testing access | Verify customers see locked screen only; internal can test | No live OAuth/customer API-key setup |

## Specific hardening checks

- [ ] Financial Center shows setup/data-quality messages for missing close days, missing cost data, missing invoices, or no P&L input.
- [ ] Daily Close writes audit logs for meaningful edits.
- [ ] Labor exports and role filters use custom Roster Roles from Preferences/Roster Roles plus active assigned roles.
- [ ] Invoice scan results cannot update inventory/costs/vendor spend until approved.
- [ ] Menu scan results cannot power menu impact alerts until approved.
- [ ] 86 alerts with approved dependencies show affected menu items in Manager Brief, Kitchen Command, Message Board, and push flow where available.
- [ ] Integrations customer screens do not expose OAuth, API keys, provider setup, or unfinished provider tools.
- [ ] Customer-facing language uses “AI-assisted,” “manager review,” “cost visibility,” “snapshot,” and “integrations coming soon.”
- [ ] Mobile layout remains usable after the hardening pass.
