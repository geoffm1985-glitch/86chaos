# 86 Chaos 17.0.72 - Nested Node Reporter Independence Repair

## Captured failure
The 17.0.71 full Yardmaster gate reached server tests and then blocked before Playwright in `api/failed-only-manifest-emulator-target-17-0-71.test.cjs`. The nested `api/failed-only-manifest-cross-version.test.cjs` process completed successfully, but the wrapper additionally required reporter-specific text matching `# pass 11`. Under the Yardmaster/Windows server-test environment, that TAP summary text was not present, so a successful nested test process was incorrectly converted into a release-gate failure.

## Surgical repair
- Bump the testing build to 17.0.72.
- Keep the existing child-process exit-status assertion as the authoritative nested test result.
- Remove only the brittle `# pass 11` / `# fail 0` output-format assertions from the 17.0.71 wrapper.
- Preserve the emulator/live Firebase target checks and the explicit `demo-86chaos` mismatch guard.
- Do not change application runtime behavior, Firebase security, deployment targeting, or production code paths.

## Coverage
- Repaired wrapper: `api/failed-only-manifest-emulator-target-17-0-71.test.cjs`.
- Targeted Node regression: `api/failed-only-manifest-reporter-independence-17-0-72.test.cjs`, which reruns the wrapper with `NODE_OPTIONS=--test-reporter=spec` and requires a zero exit status while both emulator and live target cases execute.
- Mandatory Play Store/release-gate Playwright regression: `tests/86chaos-release-gate/84-failed-only-manifest-reporter-independence-17-0-72.spec.cjs`.
- Independent Playwright regression: `tests/e2e/failed-only-manifest-reporter-independence-17-0-72.spec.cjs`.

No production push or deployment is included.
