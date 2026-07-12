# 86 Chaos 15.0.58 Release Notes

## Website Claim Readiness Hardening

Version 15.0.58 is a verification, hardening, polish, and completion pass against the public 86 Chaos website promise. It does not remove features, tabs, routes, workflows, permissions, reports, API routes, Firebase rules, documents, or UI sections.

### Preserved from previous releases

- 15.0.57 desktop UI refinement remains intact.
- 15.0.56 restaurant-group push broadcasts remain intact.
- 15.0.54 tier, Founder Beta, feature gate, scan limit, and integration lock system remains intact.
- Firebase Admin environment behavior remains compatible with the working setup: full JSON in `FIREBASE_SERVICE_ACCOUNT_KEY` plus `CRON_SECRET`.

### Hardened in this release

- App-shell Firestore subscriptions are now more plan-aware and role-aware before opening restricted data listeners.
- Financial, labor, sales, inventory, Menu Intelligence, and COGS collection subscriptions are avoided when the current user and workspace plan cannot access the feature.
- Staff Roster role defaults no longer prefer a hardcoded restaurant role in active UI logic.
- Older drawer/settings/team components were adjusted so hardcoded kitchen-role logic is treated as legacy fallback behavior only when no custom roster role list is available.
- Schedule/month role color styling no longer special-cases a single hardcoded role.
- Help Center now includes a customer-facing “What 86 Chaos connects for a restaurant” article that matches safer public wording.
- Administrator Manual now includes a 15.0.58 internal readiness note about website claims, manager review, plan-aware data reads, and Roster Roles as source of truth.

### Confirmed implementation behavior

- AI-assisted invoice scanning keeps a manager review step before affecting inventory, invoice history, vendor spend, COGS, reports, or cost visibility.
- AI-assisted menu scanning keeps a manager review step before writing Menu Intelligence dependency data used by menu impact alerts.
- Financial Center language keeps P&L as an operational snapshot, not tax-ready accounting.
- Integrations remain locked for customers and described as coming soon.
- Direct feature access remains controlled by the centralized plan/feature gate system plus user role/permission checks.

### Not included

- No live Stripe billing.
- No live POS/accounting OAuth rollout.
- No customer-facing provider API key setup.
- No feature removal or UI simplification-by-deletion.
