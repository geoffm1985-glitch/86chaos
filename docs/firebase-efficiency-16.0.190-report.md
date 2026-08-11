# Firebase Efficiency 16.0.190 Report

Comparison: 16.0.189 baseline to 16.0.190 candidate. Metrics are application-side only and are labeled MEASURED, ESTIMATED, or NOT MEASURABLE LOCALLY. No Firebase billing costs are invented.

## Presence
- MEASURED: connect remains one active RTDB session write under `status/{workspace}/{firebaseAuthUid}/sessions/{connectionId}`.
- MEASURED: disconnect removes the active session and may update durable Last Seen in `statusSummary`.
- MEASURED: multi-device truth remains: any active session keeps the user online.

## Team
- MEASURED: Team quick tab bounce inside the 45-second cache window still performs 0 additional workspace presence API requests.

## Today / Manager Brief
- ESTIMATED: 16.0.189 and 16.0.190 both keep the corrected 277 maximum initial document plan, including users, shifts, time off, events, time punches, inventory, maintenance, prep, tasks, restaurantAdminAlerts=8, and opsIntelligenceReports=3.
- MEASURED: Today active listener count remains 0.
- MEASURED: Refresh Brief now invalidates only the `today-brief` cache scope.
- MEASURED: non-Today cache invalidations caused by Refresh Brief = 0.
- MEASURED: Schedule and Team caches are retained by scoped Refresh Brief.
- MEASURED: TTL stays 45 seconds; `refreshKey` is separate and does not mutate TTL.

## My Schedule
- MEASURED: canonical path remains the cheap `scheduleUserId` primary query.
- MEASURED: legacy rescue uses identity-specific `employeeId + date`, exhausted `scheduleDateKey` range, and exhausted `date` range query sources.
- MEASURED: a matching legacy current-user shift beyond row 120 remains visible.
- MEASURED: a matching legacy current-user shift beyond row 1,500 remains visible.
- MEASURED: date-only legacy shift remains visible.
- MEASURED: scheduleDateKey-only legacy shift remains visible.
- MEASURED: email and unique full-name legacy identity remain visible.
- MEASURED: ambiguous same-first-name legacy row is not assigned automatically.
- MEASURED: rescue reports `evaluatedAllPages: true` and `truncated: false` when the bounded date range is exhausted.

## Reminders / PAR / HR / Menu / Audit Log
- MEASURED: reminder no-90-second-polling behavior is preserved.
- MEASURED: PAR typing still commits once and no-op suppression remains.
- MEASURED: HR aggregate-count/lazy loading is preserved.
- MEASURED: Menu dependency ownership and cursor scan pagination are preserved.
- MEASURED: Audit Log cursor pagination is preserved.

## Bulk audit/write amplification
- MEASURED: reviewed, intentionally preserved. No further broad consolidation was made because remaining workflows need per-record operational, import, account, or security evidence.
