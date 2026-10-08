# 86 Chaos 17.0.70 - Hostile Fixture Manifest Version Repair

## Captured failure
The 17.0.69 full release gate passed clean-tree preparation, then blocked before Playwright in hostile certification at `api/release-gate-execution-17-0-5.test.cjs`. Its synthetic "good source" fixture still generated the historical manifest shape `{ schemaVersion, sourceHash, files }`.

The current source validator now requires the bundled release manifest to carry `version` as part of release identity. Production preflight/source-manifest logic was correct; the historical hostile fixture was stale and could not complete its own mandatory `npm run test:source` good path.

## Surgical repair
- Bump the testing build to 17.0.70.
- Change only the historical hostile fixture manifest shape: schema 2 plus `version: initial.version`, preserving its source hash and file inventory behavior.
- Do not weaken Node 24, clean-tree, immutable deployment, manifest, or hostile-certification checks.
- Preserve production runtime behavior unchanged.

## Coverage
- Historical dynamic reproducer remains `api/release-gate-execution-17-0-5.test.cjs`.
- Targeted Node regression: `api/release-gate-hostile-fixture-manifest-17-0-70.test.cjs`, including a temporary synthetic manifest that must pass the current source validator.
- Mandatory Play Store/release-gate Playwright regression: `tests/86chaos-release-gate/82-release-gate-hostile-fixture-manifest-17-0-70.spec.cjs`.
- Independent Playwright regression: `tests/e2e/release-gate-hostile-fixture-manifest-17-0-70.spec.cjs`.

No production push or deployment is included.
