# 86 Chaos 15.0.6 Release Notes

## Menu Scan Fast Delete

Version 15.0.6 speeds up Menu Intelligence deletion and makes the delete action harder to accidentally trigger twice.

### What changed

- Menu scan deletion now uses Firestore batched deletes for the scan summary and its linked menu-impact dependency records.
- The Recent Menu Scans row shows a real delete progress bar with record count, percent, and elapsed timer.
- Edit and delete buttons are disabled while a menu scan delete is running.
- Stale dependency links removed during menu scan editing also use batched deletes.
- No 15.0.6 release note was added to the public Help Center.

### Deploy notes

- Deploy the updated app code through Vercel/GitHub.
- No Firestore rules changes are required beyond the already-published 15.0.5 rules.
- No Storage rules changes are required.
- No new API route or environment variable is required.
