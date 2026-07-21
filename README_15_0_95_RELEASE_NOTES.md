# 86 Chaos 15.0.95 Release Notes — System Admin Gate Hotfix

## What changed
- Replaced the non-super-admin `godmode` denial screen with a generic Plan & Permission Gate.
- Removed exposed Super Admin diagnostic details from accounts that are not authorized for System Administrator.
- Kept real System Administrator access unchanged for verified Super Admin accounts.

## Why
The Playwright permission matrix correctly found that a STAFF account could directly open `?tab=godmode` and see internal diagnostics, including environment/configuration guidance. The account was blocked from the actual tool, but the denial screen exposed too much internal information.

## Files changed
- `src/App.js`
- `src/core/appCore.js`
- `public/version.json`
- `package.json`
- `package-lock.json`

## Notes
- This does not enable live QuickBooks posting. QuickBooks remains review-first/draft/export-friendly.
- This does not change Firebase service account keys.
