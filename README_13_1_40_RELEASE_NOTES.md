# 86 Chaos 13.1.40 Release Notes

## Owner Staff Removal Repair

- Fixed account-owner staff removal from Staff Roster.
- Non-Super Admin owner removals now go through the verified `api/staff-member.js` route instead of direct client Firestore writes.
- Staff removal now deactivates the employee profile and disables the Firebase Auth login when possible, while historical schedules, time punches, payroll records, and audit history stay intact.
- The API prevents users from removing their own active account from Staff Roster.
- Account-owner profiles are protected from removal unless a Super Admin performs the action.
- Staff removals now create a sensitive audit log entry.

## Deploy Notes

- Vercel must deploy the updated `api/staff-member.js` route.
- No new environment variables are required.
- No Storage rules change is required.
- Firestore rules are included for consistency with the current build.
