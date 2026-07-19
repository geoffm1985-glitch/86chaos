# 86 Chaos 15.0.89 Version Sync Hotfix

## What changed

- Fixed the version mismatch that caused the red "System update available" banner to appear after deployment.
- Synchronized the app runtime version, `/version.json`, root package metadata, root lockfile metadata, Functions package metadata, and API version markers to `15.0.89`.
- Added a repair validation check that fails if the runtime version, public version file, package files, or Functions package files drift apart again.
- Kept the 15.0.88 Vercel install hotfix intact: `npm ci`, public npm registry, Node/NPM engine pins, no empty `requirements.txt`, and no internal audit registry URLs.

## Firebase service account handling

No Firebase service-account-key parsing or environment-variable logic was changed in this hotfix.

## Deploy note

After this deployment finishes, open the exact deployed URL and press **Refresh Now** once if an old browser tab is still running the previous JavaScript bundle. After the new bundle loads, `/version.json` and the app runtime both report `15.0.89`, so the update banner should stay gone until a real future version is deployed.

## Local validation

Validated the version-sync guard, repair checks, rules checks, source syntax checks, Functions build, and production React build.
