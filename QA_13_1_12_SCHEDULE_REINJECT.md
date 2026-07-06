# QA 13.1.12: Emergency Schedule Reinject

## Setup

- Deploy to staging first.
- Log in as the master admin or a Super Admin.
- Confirm the restaurant ID is `cheers_chilton_01`.

## Test

1. Open **System Administrator → Forensics**.
2. Find **Emergency Schedule Rescue**.
3. Click **Reinject Cheers July 2026 Schedule**.
4. Cancel the prompt once and confirm nothing changes.
5. Click again and type `REINJECT JULY`.
6. Confirm a backup JSON downloads.
7. Confirm the success popup shows deleted and imported counts.
8. Open **Time Clock & Schedule → Full Schedule**.
9. Move to July 2026.
10. Confirm the schedule is restored for July 1 through July 31.
11. Open **Schedule Builder** and confirm the same shifts appear there.
12. Confirm the audit log includes `EMERGENCY_REINJECT_JULY_SCHEDULE_BUTTON` or `EMERGENCY_IMPORT_JULY_SCHEDULE`.

## Expected

- Only July 2026 shifts for `cheers_chilton_01` are replaced.
- Other restaurants are untouched.
- Other months are untouched.
- 113 published shifts are imported.
