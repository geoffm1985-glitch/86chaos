# 86 Chaos 17.0.8

Release: Vercel Deployment-Safe Identity Repair

Status: repaired application candidate. Full deployed release-gate certification is still required after the `testing` deployment is READY.

## Why 17.0.8 exists

The Vercel `testing` deployment failed for 17.0.5, 17.0.6, and 17.0.7 at the build step. Vercel reports the latest 17.0.7 deployment (`dpl_HRRBcj153vX28fKwt2NDLozX4qF6`, commit `7d31e3a47f36e57a73f9ad7651657b99b138b7a8`) as `ERROR` with `BUILD_UTILS_SPAWN_1`, while the restored 17.0.4 predecessor (`dpl_9gnJP8CbZ6qc3t8YKiGtEQG2UQLF`, commit `fef81f5f59754194102be17a45fcf60ac1bcd31e`) is `READY`.

The repeated failure line begins with the release series that moved strict source-tree verification into the Vercel `prebuild` path. 17.0.6 and 17.0.7 tried to make that workspace verification more tolerant, but the build still depended on assumptions about Vercel's temporary workspace. That is the wrong boundary.

## Permanent repair

17.0.8 separates deployment availability from certification evidence:

- Normal Vercel builds no longer scan or byte-compare the temporary Vercel workspace.
- Build identity is bound to Vercel's immutable `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, and the committed deterministic `release-source-manifest.json`.
- Strict workspace comparison still exists as the opt-in diagnostic `CHAOS_STRICT_VERCEL_BUILD_WORKSPACE=1`; it is not part of the normal deployment-critical path.
- Build identity stamping is fail-open for deployment. If identity evidence cannot be produced, `public/build-identity.json` is written with `identityStampStatus: "degraded"` instead of throwing and killing the Vercel build.
- Certification remains fail-closed. The release preflight now explicitly rejects any client or server identity whose `identityStampStatus` is not `verified`, and still requires exact manifest, Git commit, branch, immutable Vercel deployment, project, Firebase test project, and protected-config hashes.
- The build-identity API exposes `identityStampStatus`, `identityStampError`, `sourceEvidence`, and `workspaceVerification` for diagnosis.

No schedule, inventory, POS Bridge, Shift4, financial, time-clock, payroll, recipe, menu, order, or production-data behavior was intentionally changed by this repair.

## Required deployment and testing sequence

After installing this ZIP over the existing `testing` checkout:

```powershell
git switch testing
npm run git:safety
git status
git add -A
node scripts/verify-repository-safety.cjs --staged
git diff --cached --stat
git diff --cached --name-status
git commit -m "Release 17.0.8: deployment-safe Vercel identity repair"
git push origin testing
git fetch origin
git rev-parse HEAD
git rev-parse origin/testing
```

Wait for the exact 17.0.8 `testing` deployment to become `READY`, then set the expected version to 17.0.8 wherever the release gate already reads it. Do not create conflicting process and `.env.test.local` values.

Targeted repair validation:

```powershell
npm run validate:17.0.8
npm run test:repair:17.0.8
```

Then run the release tests:

```powershell
npm run test:play-store:failed
npm run test:play-store:delta
npm run test:play-store
```

Only the final complete `npm run test:play-store` can certify 17.0.8.
