# 86 Chaos 17.0.73 - Failed-Only Recovery Emulator Target Repair

## Captured failure
The 17.0.72 full Yardmaster gate blocked before Playwright in `api/failed-only-repair-selection-16-0-153.test.cjs`. Its historical focused-run evidence correctly represented the old live testing project `chaos-test-d1601`, but the fixture also passed that historical project literal into validation of the **current** remediation run. Under Yardmaster EMULATOR mode, the shared target is `demo-86chaos`, so the current validator correctly rejected the stale literal.

## Surgical repair
- Bump the testing build to 17.0.73.
- Keep all historical preflight/summary evidence in the fixture pinned to `chaos-test-d1601`.
- Change only the current recovered-manifest validation argument to `expectedFirebaseProject(process.env)`.
- Do not change application runtime behavior, Firebase security, deployment targeting, or production code paths.

## Coverage
- Repaired historical fixture: `api/failed-only-repair-selection-16-0-153.test.cjs`.
- Targeted Node regression: `api/failed-only-repair-selection-emulator-target-17-0-73.test.cjs`, which executes the exact historical fixture in both emulator and live modes.
- Mandatory Play Store/release-gate Playwright regression: `tests/86chaos-release-gate/85-failed-only-repair-selection-emulator-target-17-0-73.spec.cjs`.
- Independent Playwright regression: `tests/e2e/failed-only-repair-selection-emulator-target-17-0-73.spec.cjs`.

No production push or deployment is included.
