# 86 Chaos 17.0.40 — Emergency Schedule and Request-Off Reliability

## Emergency production repairs

- Ghost Mode Request Off cancellation remains on the authoritative server/Admin SDK path, suppresses the conflicting client Request Off listener while possessing a user, and now has browser regression evidence that cancellation does not trigger Firestore `INTERNAL ASSERTION FAILED: Unexpected state` and that exiting Ghost Mode restores the System Administrator session.
- Schedule coverage warnings are sorted by real ISO date/time order.
- Coverage targets now evaluate distinct-person concurrency across the entire required time window instead of requiring a shift to start at exactly the target start time. Staggered handoffs and overnight shifts are included, and duplicate shifts for one person do not inflate coverage.
- Partial-day Request Off rejects malformed, equal, or backwards ranges such as 4:00 PM → 2:00 PM in UI validation, the authoritative server API, and Firestore write rules.
- Schedule Builder day/date headers stay visible while vertically scrolling, remain aligned with the schedule columns during horizontal scrolling, and account for the sticky desktop control deck without covering controls.

## Release Gate / Play Store coverage re-analysis

17.0.40 adds an explicit full-app traceability matrix tying the existing dynamic source/control/route/workflow inventories to their automated gate layers. The audit covers production source and API handlers, every canonical route and declared nested state, interactive controls, mutating workflows, role/permission boundaries, responsive layouts, accessibility, business math, runtime code coverage, recovery/crash paths, Firestore/storage rules, security/API fuzzing, PWA/installability, and test-universe integrity.

Behaviors that cannot honestly be automated by the browser/CI gate are explicitly listed as manual-only evidence with a reason. Automatable uncovered behavior is treated as a release-gate defect rather than silently excluded.

## New regression evidence

- `api/emergency-schedule-requestoff-17-0-40.test.cjs`
- `tests/86chaos-release-gate/54-emergency-schedule-requestoff.spec.cjs`
- `tests/86chaos-release-gate/55-full-surface-traceability.spec.cjs`
- Expanded `tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs`
- `test-tools/certification/release-gate-traceability-17-0-40.json`
