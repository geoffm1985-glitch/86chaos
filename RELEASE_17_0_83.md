# 86 Chaos 17.0.83 - Request Off Maturity Refactor Certification Repair

The first owned 17.0.82 full gate blocked before Playwright in api/release-gate-maturity-16-0-210.test.cjs.

The failure was certification-only. The 16.0.210 maturity test still required the seeded schedule-date expression to exist inline in tests/e2e/schedule-request-off-management.spec.cjs, but 17.0.82 had intentionally extracted that behavior to tests/e2e/utils/schedule-request-off-fixture-anchor.cjs. The runtime behavior remained present and wired into the same Request Off Playwright flow.

17.0.83 makes the smallest evidence-backed repair:

- the historical maturity test verifies return fixture.currentWeekStart || overCoverageDate || fixture.anchor in the extracted helper;
- it separately verifies the live Request Off spec still consumes scheduleFixtureDateFromSeed(seed) for its seeded clock;
- the existing archive-only Allen QA workflow-row assertions remain unchanged;
- production scheduling and Request Off runtime logic are unchanged;
- targeted Node, Play Store/release-gate Playwright, and independent Playwright regression coverage now pin the exact refactor boundary.

The saved fullFirstComplete checkpoint remains false because the 17.0.82 run blocked before Playwright. The next Yardmaster run must therefore be RUN full.

No production push is authorized by this build.