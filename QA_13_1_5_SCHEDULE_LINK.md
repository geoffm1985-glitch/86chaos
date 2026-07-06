# 86 Chaos 13.1.5 QA: Schedule Copilot + Builder Linked

## What changed
- Schedule Copilot Coverage Targets now use the same role names as the Schedule Builder staff list.
- Coverage target roles are normalized against Staff Roster / Settings roles before saving.
- Smart Fill creates draft shifts using the matched employee's actual Staff Roster role.
- Draft shifts created by Schedule Copilot also keep `targetRole` for review.
- Help Center and version were updated to 13.1.5.

## Test steps
1. Open Settings and create custom roles such as Line Cook, Server, Bartender, Host, Dishwasher.
2. Open Staff Roster and assign those roles to active employees.
3. Open Time Clock & Schedule → Schedule Builder.
4. Check the staff grid role headers.
5. In Schedule Copilot → Coverage Targets, open the Role dropdown.
6. Confirm the role dropdown matches the restaurant's staff roles instead of acting like a separate hard-coded list.
7. Add a target, for example Friday → Line Cook → 4:00 PM-9:00 PM → count 2.
8. Click Smart Fill.
9. Confirm draft shifts appear in the same Schedule Builder grid.
10. Confirm the draft shifts use the employee's actual Staff Roster role and publish normally.

## Pass condition
Coverage Targets, Templates, Smart Fill, and the Schedule Builder grid all speak the same role language for that restaurant.
