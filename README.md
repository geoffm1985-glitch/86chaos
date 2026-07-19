# 86 Chaos 15.0.88

86 Chaos is a restaurant and kitchen management web app for independent restaurants, bars, and kitchens. This package is the audit-repair hardening build based on the uploaded 15.0.86 hotfix source.

## What changed in 15.0.87 and 15.0.88

- Separated Team Management from financial, inventory, scan, and system security authority.
- Added server-side audit logging through `/api/audit-log` and blocked normal client-created `auditLogs` records in Firestore rules.
- Routed browser crash/user bug reports through `/api/report-bug` and blocked direct client writes to `crashReports`.
- Tightened invoice file and profile-photo Storage rules.
- Changed Founder Beta defaults and new-tenant beta creation to 90 days.
- Added entitlement-active checks to plan gates in Firestore rules.
- Preserved the complete JSON `FIREBASE_SERVICE_ACCOUNT_KEY` behavior. Do not split or rename it unless intentionally adding optional aliases.
- Hardened scan authorization so custom roster role names like “Admin” or “Owner” do not grant server-side scan access by label alone.
- Hardened elevated MFA checks so they depend on actual owner/admin flags and privileged permissions, not plain role-name strings.
- Improved reminder dispatch retry behavior, ordering, recurring monthly dates, and no-token handling.
- Added Firebase Messaging browser support guards.
- Added authenticated geocode lookup enforcement.
- Reduced oversized image assets.
- Added validation scripts and current-version docs.


## Vercel install hotfix in 15.0.88

- Vercel now uses `npm ci` through `vercel.json` instead of falling back to `npm install`.
- The root lockfile uses the public npm registry, not any temporary audit-environment registry.
- The comment-only `requirements.txt` was removed because the Python API functions use only the standard library.
- Build memory and sourcemap settings are declared in the Vercel build command.

## Build and validation

```bash
npm ci --omit=optional --no-audit --no-fund --progress=false
npm test
npm run rules:check
NODE_OPTIONS=--max-old-space-size=4096 GENERATE_SOURCEMAP=false DISABLE_ESLINT_PLUGIN=true npm run build
npm --prefix functions ci
npm --prefix functions run build
```

## Deployment notes

Deploy the app, Firestore rules, Storage rules, and Functions/API changes together. This release changes security boundaries, so deploying only the frontend is not enough.

See `POST_REPAIR_QA.md`, `SECURITY.md`, `DEPLOYMENT.md`, and `RELEASE_NOTES_15.0.88.md` before production rollout.
