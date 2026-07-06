# QA — 13.1.13 Schedule Rescue Hard Replace

## Goal

Confirm that the emergency schedule rescue fully replaces July 2026 instead of letting old/restored shifts return.

## Test steps

1. Deploy to staging first.
2. Log in as Super Admin.
3. Open System Administrator → Forensics.
4. Use Emergency Schedule Rescue.
5. Type `REINJECT JULY`.
6. Confirm a backup JSON downloads.
7. Confirm the app reloads after success.
8. Open Time Clock & Schedule → Full Schedule.
9. Move to July 2026.
10. Confirm the July PDF schedule is present.
11. Refresh the page.
12. Confirm the old/deleted schedule does not replace it.
13. Open Schedule Builder.
14. Confirm the same July shifts appear there.
15. Run the rescue a second time.
16. Confirm there are no duplicate shifts.
17. Confirm auditLogs has `EMERGENCY_IMPORT_JULY_SCHEDULE_HARD_REPLACE`.
18. Confirm scheduleRestoreRuns has a new run record.
19. Confirm scheduleRestoreSeeds has `cheers_chilton_01_2026_07`.

## Pass condition

The imported July 2026 schedule remains after refresh/reload and old schedule records do not come back.
