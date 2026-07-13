# 86 Chaos 15.0.63 Changed Files Report

## Changed

- `src/features/management.jsx`
  - Sanitized Maintenance Mode enable/clear Firestore payloads.
  - Converted missing prior maintenance history values from `undefined` to `null`.
  - Cleared stale maintenance fields with explicit `null` values.

- `src/core/appCore.js`
  - Updated current app version marker to `15.0.63`.

- `package.json`
  - Updated package version to `15.0.63`.

- `public/version.json`
  - Updated public version metadata to `15.0.63`.

## Added

- `README_15_0_63_RELEASE_NOTES.md`
- `QA_15_0_63_MAINTENANCE_MODE_HOTFIX.md`
- `86chaos_15_0_63_changed_files_report.md`
- `86chaos_15_0_63_deployment_notes.md`
- `86chaos_15_0_63_build_verification.md`

## Removed from clean package root

- Previous 15.0.62 release/QA/report files, so the package contains current-release docs only.

