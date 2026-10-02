# 86 Chaos 17.0.55

## Firebase Emulator CRA Build Repair

This release repairs the 17.0.54 Vercel `module_not_found` build failure without changing the Firebase emulator behavior introduced in 17.0.54.

- The single shared emulator configuration now lives at `src/core/firebase-emulator.config.json`, inside Create React App's allowed source boundary.
- Browser Firebase target code imports the config from the same `src/core` directory.
- Node/release-gate tooling reads that same canonical config file instead of maintaining a duplicate.
- LIVE remains the default Firebase target.
- EMULATOR remains fail-closed, loopback-only, and pinned to `demo-86chaos`.
- New Play Store/release-gate source coverage and Playwright startup coverage permanently guard the CRA import boundary.
- Production is not deployed by this release.
