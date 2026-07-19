# 86 Chaos 15.0.88 Vercel Install Hotfix

## What changed

- Fixed the Vercel install surface that caused `npm install` to fail with `Exit handler never called`.
- Added a Vercel `installCommand` that uses deterministic `npm ci` instead of defaulting to `npm install`.
- Added Node/NPM engine pins for Vercel: Node 20.x and npm 10.x.
- Added `.npmrc` with the public npm registry so the lockfile cannot point at a private audit-environment registry.
- Removed the comment-only `requirements.txt` file that caused Vercel to warn that no Python dependencies were present. The Python API files currently use only the standard library.
- Removed transient audit/build artifacts from the package: `build.pid`, `build.exit`, Python bytecode, and `__pycache__`.

## Firebase service account handling

No Firebase service-account-key parsing or environment-variable logic was changed in this hotfix.

## Deploy note

Vercel should now run:

```bash
npm ci --omit=optional --no-audit --no-fund --progress=false
NODE_OPTIONS=--max-old-space-size=4096 GENERATE_SOURCEMAP=false DISABLE_ESLINT_PLUGIN=true npm run build
```

## Local validation

Validated clean `npm ci`, repair checks, rules checks, and production build with the same memory/sourcemap settings now declared for Vercel.
