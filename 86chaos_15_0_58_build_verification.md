# 86 Chaos 15.0.58 Build Verification

## Static verification completed in container

Passed:

- Verified current ZIP was unpacked and patched in place.
- Updated active version markers to `15.0.58`:
  - `package.json`
  - `functions/package.json`
  - `public/version.json`
  - `src/core/appCore.js`
  - `README.md`
- Checked all Vercel API JavaScript files with `node --check`.
- Checked central non-JSX JavaScript files with `node --check`:
  - `src/config/plans.js`
  - `src/lib/featureAccess.js`
  - `src/core/appCore.js`
- Parsed all JSON files outside excluded build folders.
- Verified brace structure for:
  - `firestore.rules`
  - `storage.rules`
- Confirmed no root `package-lock.json` was added, preserving the working Vercel deploy shape.
- Confirmed old 15.0.57 release/QA docs were removed from the clean source and current 15.0.58 docs were added.

## Full build status

The React production build and Firebase Functions TypeScript build could not be completed inside this container because dependency installation timed out repeatedly before `node_modules` were available. No source compile error was observed from the static checks, but Vercel Preview remains the required source of truth for the full optimized React build.

Required credentialed/external verification:

- Vercel Preview build.
- Real desktop and mobile-width browser pass.
- Owner/admin/staff login pass.
- Firebase Rules Playground or real account tests for locked staff access.
- AI scan limit and review workflow test against configured Vercel/Firebase environment.

## Package cleanup verification

The clean ZIP excludes:

- `node_modules`
- root `build`
- Functions `lib`
- screenshots
- tests
- temp logs
- root `package-lock.json`
