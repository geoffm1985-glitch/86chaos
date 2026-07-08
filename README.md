# 86 Chaos

Current version: 15.0.6

## 15.0.6 focus

This build keeps the 15.0.5 manual presence snapshot work intact, then makes Menu Intelligence scan deletion faster and safer:

- Recent Menu Scans now delete linked `menuDependencies` and the scan summary using Firestore batched deletes instead of one document write at a time.
- Delete buttons lock while a menu scan delete is running so users cannot double-click and start duplicate delete attempts.
- A delete progress bar shows records deleted, percent, and elapsed time.
- Editing a menu scan now also removes stale dependency links through the same batched delete helper.
- No 15.0.6 release note was added to the public Help Center.

## Deploy notes

1. Deploy the updated app through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.6` after deploy.
3. Open Menu Intelligence and delete a recent menu scan with several links.
4. Confirm the row shows delete progress and the delete/edit buttons are disabled while it runs.
5. Confirm the scan summary and only its linked menu-impact dependencies are removed.
6. Run the 15.0.6 QA checklist before handing it to staff.

## Separate publish/deploy requirements

- Firestore rules: no new changes from 15.0.5.
- Storage rules: no new changes from 15.0.5.
- Vercel/API routes: deploy the updated app code. No new API route was added.
- New Vercel env vars: none.
