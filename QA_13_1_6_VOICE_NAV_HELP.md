# QA - 13.1.6 Voice Navigation + Help Search

## Voice navigation tests

Use the microphone or typed command box.

- [ ] Say: "show me the full schedule"
  - Expected: Time Clock & Schedule opens to Full Schedule.

- [ ] Say: "show me the month view"
  - Expected: Time Clock & Schedule opens to Month View.

- [ ] Say: "show me my schedule"
  - Expected: Time Clock & Schedule opens to My Schedule.

- [ ] Say: "show me the trade board"
  - Expected: Time Clock & Schedule opens to Trade Board.

- [ ] Say: "show me time off"
  - Expected: Time Clock & Schedule opens to Request Off / Time Off.

- [ ] Say: "show me schedule builder"
  - Expected for manager with schedule permission: Schedule Builder opens.
  - Expected for regular employee: Access Blocked.

- [ ] Say: "show me staff list"
  - Expected for user with team permission: Staff Roster opens.
  - Expected for regular employee: Access Blocked.

- [ ] Say: "open financials"
  - Expected for manager/labor/sales permission: Financials opens.
  - Expected for regular employee: Access Blocked.

- [ ] Say: "open system administrator"
  - Expected for Super Admin: System Administrator opens.
  - Expected for everyone else: Access Blocked.

## Help Center search tests

- [ ] Say: "search help center for missed punch"
  - Expected: Help Center opens with search field filled as "missed punch".

- [ ] Say: "help me with geofence"
  - Expected: Help Center opens with search field filled as "geofence".

- [ ] Say: "how do I add employees"
  - Expected: Help Center opens with search field filled as "add employees".

## Existing voice command safety regression

- [ ] Say: "prep 2 pans ranch"
  - Expected: Prep task name is Ranch, quantity is 2, unit is pans.

- [ ] Say: "add ranch to prep list"
  - Expected: Prep task name is Ranch, not "add ranch to prep list".

- [ ] Say: "86 salmon"
  - Expected: Confirmation appears before inventory is changed.

## Notes

Voice navigation is allowed to move between screens, but it must never bypass permissions or hidden module settings.
