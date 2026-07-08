# 86 Chaos

Current version: 15.0.12

## 15.0.12 focus

15.0.12 adds a real public Help Center guide for Menu Intelligence so managers can use the intelligent menu without reading scattered release notes.

## What changed

- Added a dedicated **Using Menu Intelligence** Help Center article.
- The article explains how to upload menu photos/PDFs, wait through compression/upload/AI scan progress, review menu items, match ingredients to real inventory rows, approve reviewed menu links, edit scans, and delete scans.
- The article explains how approved Menu Intelligence links help 86 alerts show affected/unavailable menu items.
- Added practical examples for kitchen shorthand such as `86 burger` matching real inventory names like `BEEF GR PTY` or beef patties.
- Added troubleshooting guidance for when an 86 alert does not show menu impact.
- Administrator Manual includes 15.0.12 support and QA guidance.

## Deployment notes

1. Deploy the app through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.12` after deploy.
3. Open Help Center and search `Menu Intelligence` or `intelligent menu`.
4. Confirm the **Using Menu Intelligence** article appears and is public-facing.
5. Confirm the article explains upload, review, approval, edit/delete, and 86 menu-impact behavior.
6. Run the 15.0.12 QA checklist before handing it to staff.

## Separate publishing required

- Firestore rules: no new changes from 15.0.11.
- Storage rules: no new changes from 15.0.11.
- Vercel/API routes: deploy the updated app code.
- New environment variables: none.
