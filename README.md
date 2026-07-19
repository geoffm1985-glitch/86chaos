# 86 Chaos 15.0.79

86 Chaos is a restaurant and kitchen management web app for independent restaurants, bars, and kitchens. This package is a safe performance/refactor build based on the production-safe 15.0.76/15.0.78 line.

## What changed in 15.0.79

- Kept login/auth eager-loaded to avoid another lockout.
- Split authenticated tabs into lazy route chunks.
- Isolated Inventory into its own feature module.
- Reduced duplicate Inventory reads from the app shell.
- Changed Inventory data loading so Count opens light and heavier data loads only when its sub-tab needs it.
- Reduced always-on recipe reads.
- Updated Vercel Node engine to 24.x.

## Important deployment note

Google Cloud API key website restrictions still must include the exact Vercel Preview URL you open, for example `https://cheers-portal-4oxv-git-testing-cheers-portal-s-projects.vercel.app/*`. Firebase Auth authorized domains must also include the same hostname without `https://` or `/*`.

## Validation

Run:

```bash
npm ci --omit=optional --no-audit --no-fund --progress=false
npm test
NODE_OPTIONS=--max-old-space-size=4096 GENERATE_SOURCEMAP=false DISABLE_ESLINT_PLUGIN=true npm run build
```

See `README_15_0_79_RELEASE_NOTES.md` and `QA_15_0_79_PERFORMANCE_SAFE_SPLIT.md` before production rollout.
