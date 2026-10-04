# 86 Chaos 17.0.71 - Failed-Only Manifest Emulator Target Repair

## Captured failure
The 17.0.70 full Yardmaster gate reached server tests, then blocked before Playwright in `api/failed-only-manifest-cross-version.test.cjs`. The cross-version fixture passed `chaos-test-d1601` as the current target Firebase project even while Yardmaster had explicitly selected the local emulator target, whose authoritative project is `demo-86chaos`.

The historical baseline evidence in that fixture is intentionally from `chaos-test-d1601` and remains unchanged. Only current-target validation was stale.

## Surgical repair
- Bump the testing build to 17.0.71.
- Resolve the current target project with the existing shared `expectedFirebaseProject(process.env)` helper in the three current-run validation calls.
- Preserve historical baseline preflight evidence as `chaos-test-d1601`.
- Do not weaken Firebase target isolation, failed-only manifest validation, or production/live project protections.

## Coverage
- Exact server fixture remains `api/failed-only-manifest-cross-version.test.cjs`.
- Targeted Node regression: `api/failed-only-manifest-emulator-target-17-0-71.test.cjs`, which executes all 11 cross-version cases in both EMULATOR and LIVE target modes.
- Mandatory Play Store/release-gate Playwright regression: `tests/86chaos-release-gate/83-failed-only-manifest-emulator-target-17-0-71.spec.cjs`.
- Independent Playwright regression: `tests/e2e/failed-only-manifest-emulator-target-17-0-71.spec.cjs`.

No production push or deployment is included.
