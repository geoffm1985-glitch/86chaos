# 86 Chaos 13.1.5 Release Notes

This is a schedule polish build focused on making Schedule Copilot and Schedule Builder act like one tool instead of two separate islands.

## Changes

- Coverage Target role choices now use the same role source as the Schedule Builder staff list.
- Roles are pulled from Staff Roster / Settings and normalized before targets/templates save.
- Smart Fill matches employees by their actual staff role and saves the final shift with the employee role.
- Draft shifts now keep `targetRole` for review when created by Schedule Copilot.
- Existing older coverage targets are normalized against the current staff role list when checking missing coverage.
- Help Center and version updated to 13.1.5.

## Quick QA

1. Create or confirm roles in Settings, such as Line Cook, Server, Bartender, Host.
2. Assign those roles to staff in Staff Roster.
3. Open Time Clock & Schedule → Schedule Builder.
4. In Schedule Copilot → Coverage Targets, confirm the Role dropdown matches the staff role groups in the builder grid.
5. Add a coverage target and run Smart Fill.
6. Confirm draft shifts appear in the same Schedule Builder grid and use the matched employee role.
