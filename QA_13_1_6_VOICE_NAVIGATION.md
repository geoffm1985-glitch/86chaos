# QA 13.1.6 Voice Navigation

## Manager / admin account
- [ ] Say: show me the full schedule. It opens Time Clock & Schedule → Full Schedule.
- [ ] Say: show me the month view. It opens Time Clock & Schedule → Month View.
- [ ] Say: show me my schedule. It opens Time Clock & Schedule → My Schedule.
- [ ] Say: show staff list. It opens Staff Roster.
- [ ] Say: show schedule builder. It opens Schedule Builder only if the account has schedule-builder access.
- [ ] Say: show coverage targets. It opens Schedule Builder only if permitted.

## Regular employee account
- [ ] Say: show full schedule. It opens Full Schedule.
- [ ] Say: show month view. It opens Month View.
- [ ] Say: show staff list. It blocks access if the employee does not have Staff Roster permission.
- [ ] Say: show financials. It blocks access if the employee does not have Financials permission.
- [ ] Say: show schedule builder. It blocks access if the employee does not have Schedule Builder permission.

## Demo mode
- [ ] Manager demo only shows tabs enabled for the demo tier.
- [ ] Employee demo cannot open admin-only tabs by voice.
- [ ] Blocked voice commands show an Access Blocked toast and do not switch screens.

