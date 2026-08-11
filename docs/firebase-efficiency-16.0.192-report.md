# Firebase Efficiency 16.0.192 Report

Scope: My Schedule identity consolidation, rescue retry telemetry, measured rescue metrics, and ordinary-staff technical-error hardening.

These numbers are deterministic fixture/helper measurements from the source tree. They are **not** production Firebase billing data.

## My Schedule Identity

| Metric | 16.0.191 baseline | 16.0.192 candidate | Label |
|---|---:|---:|---|
| Production identity implementations | 2 | 1 | MEASURED |
| employeeId indexed query fanout | 0 | 0 | MEASURED |
| Arbitrary durable aliases queried as employeeId | no | no | MEASURED |

16.0.192 removes the remaining fallback copy of the My Schedule identity algorithm from `scheduleQueryPlanner.js`. `scheduleEfficiency.cjs` and `scheduleQueryPlanner.js` now both delegate to `scheduleIdentity.cjs`.

## Deterministic 1,600+ Shift Rescue Fixture

| Metric | Value | Label |
|---|---:|---|
| queryRequestCount | 28 | MEASURED |
| scheduleDateKeyPageCount | 14 | MEASURED |
| datePageCount | 14 | MEASURED |
| documentsDelivered | 3210 | MEASURED |
| duplicateDeliveries | 1602 | MEASURED |
| uniqueMatchingLegacyRows | 8 | MEASURED |
| employeeIdIndexedQueryCount | 0 | MEASURED |
| evaluatedAllPages | true | MEASURED |
| truncated | false | MEASURED |

Supported rows in the fixture include the >1,500-row legacy shift, date-only legacy shift, scheduleDateKey-only legacy shift, imported/restored legacy shift, adjacent-month/pay-period shift, email identity, full-name match, and unique first-name fallback. Ambiguous first-name matching still fails closed.

## Retry Telemetry

| Scenario | retryCount | Label |
|---|---:|---|
| Initial automatic rescue | 0 | MEASURED |
| First explicit retry | 1 | MEASURED |
| Second explicit retry | 2 | MEASURED |
| New workspace/employee/date context | 0 | MEASURED |

`lastAttemptSucceeded` is exposed separately so a successful retry does not falsely imply no retry occurred.

## Incomplete Rescue Error Display

| User type | Raw technical error visible | Plain warning | Retry | Label |
|---|---:|---:|---:|---|
| Staff with schedule permission | false | true | true | MEASURED |
| Owner/System diagnostics user | sanitized compact diagnostic | true | true | MEASURED |

Ordinary staff see only the plain incomplete-schedule warning. Technical rescue details are gated to privileged diagnostic users and sanitized/truncated.

## Deferred

A shared broad legacy rescue cache was reviewed and deferred. Without live invalidation proof, caching broad schedule candidates could hide newly published or edited shifts. Correctness remains the priority.
