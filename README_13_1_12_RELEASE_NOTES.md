# 86 Chaos 13.1.12 Release Notes

## Emergency Schedule Rescue

Added a guarded System Administrator button under **Forensics** to reinject the uploaded Cheers Chilton July 2026 schedule.

- Restaurant ID: `cheers_chilton_01`
- Month restored: July 2026
- Imported shifts: 113 published shifts
- Source: uploaded PDF schedule, normalized for two obvious AM/PM typos
- Safety: requires typing `REINJECT JULY`
- Backup: downloads a JSON backup of any July 2026 shifts it replaces
- Audit: writes a System Administrator audit log entry

## Notes

The import route also validates that all employees from the schedule exist in the target restaurant before deleting anything.
