# 86 Chaos 17.0.77 - Server Certification Drift Repair

## Captured failure

The 17.0.76 full Yardmaster gate blocked before Playwright because `npm run test:server` reported six stale certification assertions. The application/runtime behavior under those assertions had already moved to newer, intentional contracts.

The six blockers were:

- the historical hostile-manifest regression hard-coded the archived 17.0.70 validator instead of invoking the current `test:source` validator;
- the 16.0.207 Schedule Builder tab semantic guard assumed `role`, `aria-label`, and `title` were adjacent even after a stable `data-testid` was inserted;
- the 16.0.209 Warnings helper guard still required the former role-name locator after the workflow moved to `schedule-copilot-warnings-tab`;
- the runner observability guard looked for the 30-minute install timeout in PowerShell after timeout ownership moved into `yardmaster-dependency-install.cjs`;
- the QA coverage regression expected no row even though the fixture deliberately contains two distinct Tuesday bartenders against a target of one, with one duplicate Chuck row that must deduplicate to existing=2;
- the Spanish fidelity guard required literal `es` inside the shared helper after the helper was generalized to assert the supplied language value and is still called with `es`.

## Surgical repair

- Bump testing build identity to 17.0.77.
- Update only the stale certification assertions so they verify the current stable contracts.
- Preserve all production scheduling, Request Off, Spanish localization, Firebase, authorization, and dependency-install behavior.
- Preserve the existing 30-minute dependency-install timeout.
- Preserve coverage math that deduplicates the duplicate Chuck shift while still counting Lani as a second distinct bartender.

## Coverage

- Exact targeted Node regression: `api/release-gate-server-certification-drift-17-0-77.test.cjs`.
- Mandatory Play Store/release-gate Playwright regression: `tests/86chaos-release-gate/89-server-certification-drift-17-0-77.spec.cjs`.
- Independent Playwright regression: `tests/e2e/server-certification-drift-17-0-77.spec.cjs`.
- The six previously failing server test files remain directly executed by the targeted Node regression.

No production push or deployment is included.
