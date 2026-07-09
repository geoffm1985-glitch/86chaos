# Files Changed for 16.0.2

## Full Harness Metadata

- `package.json`
  - Updated package version to `16.0.2`.
- `public/version.json`
  - Updated app version metadata to `16.0.2`.
- `public/manifest.json`
  - Updated PWA theme/background colors for the dark command-center shell.
- `README.md`
  - Replaced 15.0.43 notes with 16.0.2 full-package summary.
- `README_16_0_2_RELEASE_NOTES.md`
  - Added release notes for 16.0.2 only.
- `QA_16_0_2_CHECKLIST.md`
  - Added QA results, build status, and manual QA checklist.
- `FILES_CHANGED_16_0_2.md`
  - Added this file list.
- `DEPLOY_NOTES_16_0_2.md`
  - Added deployment notes for the full 16.0.2 package.

## Source Overlay

- `src/core/appCore.js`
  - Updated shared theme tokens and `CURRENT_VERSION`.
- `src/App.js`
  - Added scoped 16.0.2 shell CSS variables and visual overrides.
  - Refined header, date strip, drawer prop pass-through, footer, mobile touch sizing, and version label.
- `src/components/common.jsx`
  - Updated logo lockup with optional customer logo beside 86 Chaos.
  - Improved modal, drawer, menu grouping, global search, quick actions, empty states, status tiles, and changelog modal.
- `src/features/auth.jsx`
  - Updated login and privacy modal styling to match the command-center system before the main shell is mounted.

## Harness Files Preserved

- `api`
- `public` assets and service worker
- `firebase.json`
- `firestore.rules`
- `storage.rules`
- `vercel.json`
- `src/index.js`
- `src/styles.css`
- legacy auxiliary component/helper files not imported by the active 16.0.2 shell
