# 86 Chaos 15.0.88 Audit Repair Summary

## Source of truth

Repaired from the uploaded `86chaos_15_0_86_load_hotfix_app_only(3).zip` source.

## Scope completed

- Patched the high-priority audit findings that could be safely repaired in source without live Firebase credentials.
- Preserved generic complete JSON `FIREBASE_SERVICE_ACCOUNT_KEY` support. The project-admin service-account selection file was compared against the uploaded source and remained unchanged.
- Added a Vercel-safe public-registry `package-lock.json` and deterministic `npm ci` install command.
- Added release notes, deployment docs, environment notes, Firebase setup notes, security notes, privacy notes, backup/restore notes, and post-repair QA.

## Commands executed

```bash
node scripts/validate-repair.js
node scripts/validate-rules.js
node --check api/*.js scripts/*.js
python -m py_compile api/*.py
npm install --package-lock-only --ignore-scripts --no-audit --no-fund --progress=false
npm test
npm run rules:check
NODE_OPTIONS=--max-old-space-size=4096 GENERATE_SOURCEMAP=false DISABLE_ESLINT_PLUGIN=true CI=false npm run build
npm --prefix functions ci --ignore-scripts --no-audit --no-fund
npm --prefix functions run build
npm audit --omit=dev --json
npm --prefix functions audit --omit=dev --json
```

## Passed

- 16 static repair validation checks passed.
- Firestore and Storage rule brace/static safety checks passed.
- API JavaScript syntax checks passed.
- Python API syntax checks passed.
- Production React build completed successfully.
- Firebase Functions TypeScript build completed successfully.

## Build output

Production build completed with these gzip sizes:

- `build/static/js/main.8ed8e847.js`: 889.69 kB
- `build/static/css/main.e919169a.css`: 19.08 kB
- `build/static/js/929.e0b1213f.chunk.js`: 4.84 kB

CRA still warns that the main bundle is larger than recommended. This is improved by asset compression but still needs deeper route-level code splitting in a future pass.

## Dependency audit status

- Root production audit: 45 total vulnerabilities reported by npm audit: 9 low, 22 moderate, 14 high, 0 critical.
- Functions production audit: 9 total vulnerabilities reported: 9 moderate, 0 high, 0 critical.

No forced dependency upgrades were performed because that could introduce larger regressions. These should be triaged deliberately in a dependency-focused pass.

## Blocked checks

The following require live safe credentials, emulator seed data, or Firebase Console access:

- Full authenticated workflow testing for owner, manager, staff, and super admin.
- Real Firestore Rules Simulator role-matrix testing.
- Real Storage upload/download tests.
- Real push notification delivery.
- Real Vercel preview/prod runtime network checks.

Manual steps are listed in `POST_REPAIR_QA.md`.

## 15.0.88 hotfix validation

- Clean root install with Vercel install command completed.
- Root lockfile was checked for internal registry URLs and none remain.
- The comment-only `requirements.txt` file was removed to prevent Vercel Python dependency warnings.
- Production build completed with the Vercel build memory/sourcemap settings.
