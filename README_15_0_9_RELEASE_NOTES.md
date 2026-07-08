# 86 Chaos 15.0.9 Release Notes

## Schedule Publishing Controls

- Added Workspace → Schedule Publishing settings for weekly, every 2 weeks, monthly, and custom 1–8 week schedule windows.
- Schedule Builder now follows the workspace publishing style instead of always using a full month.
- Publish Schedule backs up and publishes only the active workspace schedule period.
- Projected labor totals and the schedule grid now follow the active publishing window.

## Published Schedule Time-Off Guard

- Added a workspace setting to allow or block employee time-off requests after a schedule date has already been published.
- Regular employees are blocked when the setting is off and a selected date already has a published shift.
- Managers/admins can still manually adjust schedules and requests.

## Safer Bulk User Deletion

- System Administrator → People bulk delete now previews every matching profile row with created date/time, workspace, role, and profile ID.
- Duplicate-email deletes require exact row selection before continuing.
- `/api/delete-users-bulk` can now delete selected profile IDs instead of blindly deleting every profile matching an email.
- Audit logs include selected profile IDs for destructive cleanup traceability.

## Notes

- No public Help Center release note was added.
- Administrator Manual was updated.
- Firestore rules and Storage rules are unchanged.
