# QA Checklist — 86 Chaos 13.1.27 Staff Roster Read-Only & Activity

## Regular Staff

- Log in as a regular staff account with no admin access.
- Confirm Staff Roster appears in the menu if the Team module is enabled.
- Open Staff Roster.
- Confirm the roster list is visible.
- Confirm there is no Add Staff form.
- Confirm there are no Reset, Edit, or Remove buttons on staff rows.
- Confirm the read-only notice appears at the top.
- Confirm each row shows a Last active label.

## Manager/Admin

- Log in as a manager/admin account.
- Open Staff Roster.
- Confirm the Add Staff / Edit Staff form appears.
- Confirm Reset, Edit, and Remove controls appear.
- Edit a test staff profile and confirm the save works.
- Confirm wage and manager/admin controls are visible only to manager/admin accounts.

## Last Active Status

- Log in on a second device as a staff account.
- Wait at least 25 seconds for the heartbeat to write.
- Refresh or reopen Staff Roster on the manager/admin device.
- Confirm that user shows Online now or a recent minute-based activity label.
- Close the second device/browser tab and check that the status ages out instead of staying permanently online.

## Voice / Navigation

- As regular staff, say or type “open staff roster” in the command mic/text box.
- Confirm it opens Staff Roster.
- Confirm edit controls are still hidden.
