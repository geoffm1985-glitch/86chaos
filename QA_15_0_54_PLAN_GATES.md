# QA 15.0.54 Plan Gates, Founder Beta, and Access Hardening

## Must test on Vercel preview/testing

1. Existing workspace with no subscription data does not crash or lock into Shift.
2. Existing no-subscription workspace resolves as Founder Beta Smart Kitchen until manually saved/backfilled.
3. Cheers/testing workspace remains usable with Founder Beta Smart Kitchen or internal testing access.
4. New beta workspace created by Master Admin includes subscription fields and selected future tier.
5. Shift user lands on Today Home/basic dashboard and does not get stranded on locked Manager Brief.
6. Shift plan locks Financial Center, Schedule Builder, Time Clock, Labor Command, Tip Center, Daily Close, Sales Breakdown, COGS, Menu Intelligence, AI Tools, and advanced reports.
7. Operations unlocks Schedule Builder, Time Clock, Timesheets, Labor Command, Missed Punches, Long Shifts, Overtime Risk, Payroll Readiness, Tip Center, Daily Close, Sales Breakdown, Kitchen Command, basic inventory, burn log, and basic reports.
8. Smart Kitchen unlocks Financial Overview, Prime Cost, COGS, invoice/menu scanning, Menu Intelligence, P&L, Budget & Targets, advanced reports, Security Center visibility where appropriate, and Backup Center where appropriate.
9. Owner Pro unlocks Smart Kitchen plus available owner/multi-location placeholders.
10. Master Admin/System Admin can see/test all features and open internal integration testing.
11. Customer tiers, including Founder Beta and Owner Pro, see the locked integrations screen and no OAuth/API-key/customer provider setup.
12. Internal integration screen does not save raw POS/payroll secrets to Firestore.
13. Staff cannot see Settings → Plan & Billing controls.
14. Owners/admins can see plan, beta status, beta end date, selected future tier, founder discount, discount end, scan usage, and integration lock status.
15. Staff only see simple unavailable/locked messages, not salesy billing controls.
16. Direct URL access to locked routes shows a safe locked screen or redirects safely.
17. Plan access still respects user permissions. A plan can include a feature while the user remains blocked by role/permission.
18. Firestore rules block normal staff from restricted financial collections.
19. Firestore rules block Shift users from Operations/Smart Kitchen inventory, invoice, menu intelligence, reports, and export collections.
20. Operations can use basic inventory and burn log but cannot use invoice scans, menu scans, COGS, Menu Intelligence, or advanced reports.
21. Smart Kitchen can use invoice/menu scan tools, menu dependency data, COGS, and advanced reports.
22. Scan limits block before Gemini/API calls run.
23. Scan usage tracks workspace, month, scan type, pages, and user where available.
24. Master Admin/internal testing account is exempt from scan limits.
25. Testing owner bypass email is exempt if configured in the bypass list or internal resolver.
26. Master Admin can reset scan usage and an audit log is written.
27. Founder Beta shows days remaining and lifecycle flag: 14 days, 7 days, 1 day, ended.
28. Beta extension adds 30 days and does not exceed the intended 90-day window from beta start.
29. Beta can be ended to active manual with founder discount dates preserved/set.
30. Beta can be canceled safely without exposing customer self-service billing controls.
31. Beta-ended workspaces are not suddenly hard-locked while live billing is not implemented.
32. Plan changes write audit logs.
33. Daily Close and Financial Center subtabs lock/unlock by tier.
34. Route/nav locks, feature cards, buttons, reports, and exports align with centralized plan access.
35. Custom Roster Roles from Preferences / Roster Roles drive labor by role, reports, filters, scheduling coverage, dashboards, exports, and permissions.
36. Old Starter/Pro/Elite/Enterprise labels do not appear as active customer-facing plan choices.
37. Help Center explains Founder Beta, plan-dependent features, and locked integrations without Master Admin implementation details.
38. Administrator Manual explains plans, Founder Beta controls, scan limits, integration lock, feature access resolver, audit trail, and role + plan access.
39. React production build succeeds.
40. Firebase Functions TypeScript build succeeds.
41. API files pass syntax checks.
42. Firestore and Storage rules parse/brace-check cleanly before publishing.
