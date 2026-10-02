# 86 Chaos 17.0.56

## Firebase Entrypoint Import Repair

This build-only testing release repairs the exact optimized Create React App compiler failure found in 17.0.55.

- `src/index.js` now imports `firebaseRuntimeTarget` directly from `src/core/firebaseTarget.js`, where the binding is actually exported.
- `firebaseEmulatorReadiness` continues to come from `src/core/appCore.js`.
- LIVE and EMULATOR Firebase behavior is unchanged.
- The 17.0.55 CRA-safe emulator configuration remains inside `src/core` and single-source.
- New Play Store/release-gate source coverage and Playwright regression coverage guard the exact entrypoint import contract.
- Production is not deployed by this release.
