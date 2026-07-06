# 86 Chaos 13.1.13 — Schedule Rescue Hard Replace

This build fixes the July schedule rescue behavior where the imported shifts could briefly appear and then old/restored schedule records could reappear.

## What changed

- Emergency Schedule Rescue now performs a hard month replacement instead of a soft merge.
- The Cheers July 2026 rescue deletes every existing July 2026 shift for `cheers_chilton_01` before writing the source schedule.
- Deletion now catches older/restored shift records with date strings, timestamps, `scheduleMonth`, `sourceMonth`, or messy date fields.
- Imported shifts are written with deterministic protected restore document IDs, so rerunning the rescue overwrites the same restore set instead of creating duplicates.
- The rescue writes `scheduleRestoreSeeds` and `scheduleRestoreRuns` records so the restore is traceable system-wide after future database backup/restore work.
- After a successful rescue, the app reloads once and opens the Full Schedule for July 2026 so cached Firestore snapshots cannot flash old records back onto the schedule.
- Help Center and Administrator Manual now explain that full database restore is merge-based and schedule months should use Emergency Schedule Rescue when they need a true clean replacement.

## Restaurant locked

- Restaurant ID: `cheers_chilton_01`
- Month: July 2026
- Confirmation phrase: `REINJECT JULY`

## Test

Use `QA_13_1_13_SCHEDULE_RESCUE_HARD_REPLACE.md`.
