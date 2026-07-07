# QA 13.1.40 - Owner Staff Delete / Remove Repair

## Required tests

1. Deploy to Preview or Production.
2. Confirm the footer shows version 13.1.40.
3. Log in as an account owner.
4. Add a temporary staff member.
5. Click the trash/remove button for that staff member.
6. Confirm the staff member disappears from the active Staff Roster without a Firebase permissions error.
7. Confirm historical schedule/time punch records are not deleted.
8. Confirm the user profile still exists in Firestore with `isActive: false`.
9. Confirm the removed employee cannot log back in unless re-added/repaired.
10. Confirm an audit log entry is created for `STAFF_DEACTIVATE`.
11. Try to remove your own owner account and confirm the app blocks it.
12. Test with a regular staff account and confirm they can view roster but cannot remove staff.
13. Test with Super Admin and confirm permanent terminate still works through the existing Super Admin-only path.

## Expected result

Account owners can remove employees from the active roster, but cannot accidentally destroy payroll/schedule history or remove themselves.
