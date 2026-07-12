# 86 Chaos 15.0.56 Changed Files

## Modified

- `api/send-push.js`
  - Added safe multi-workspace `restaurantIds` support.
  - Added internal-admin gating for group/platform sends.
  - Added token deduplication across selected workspaces.
  - Added audit log writes for workspace/group push broadcasts.
  - Expanded last push status metadata.

- `src/features/management.jsx`
  - Added Targeted Push Broadcast UI to Push Control Center.
  - Added workspace/group/all target modes.
  - Added group preview and recipient/token counts.
  - Added restaurant group resolver helpers.
  - Added Administrator Manual article for 15.0.56.

- `src/core/appCore.js`
  - Updated `CURRENT_VERSION` to 15.0.56.

- `package.json`
  - Updated version to 15.0.56.

- `functions/package.json`
  - Updated version to 15.0.56.

- `public/version.json`
  - Updated runtime version metadata to 15.0.56.

- `README.md`
  - Updated current release summary and deployment notes.

## Added

- `.env`
  - Non-secret build-stability flags only: disables CRA ESLint plugin and sourcemaps during production builds.

- `README_15_0_56_RELEASE_NOTES.md`
- `QA_15_0_56_PUSH_GROUPS.md`

## Removed from package root

- Previous current-version-only release/QA docs for 15.0.55 were replaced by 15.0.56 docs.
