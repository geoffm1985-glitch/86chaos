# Firebase Efficiency Report 16.0.191

Baseline: 16.0.190. Candidate: 16.0.191.

No Firebase billing costs are estimated. Metrics are application-side and labeled as measured, estimated, or not measurable locally.

## My Schedule legacy rescue

| Metric | 16.0.190 | 16.0.191 | Label |
|---|---:|---:|---|
| EmployeeId indexed query count | up to 20 alias-derived queries | 0 | MEASURED |
| Redundant employeeId fanout | true | false | MEASURED |
| Broad scheduleDateKey pages | until bounded date-window exhaustion | unchanged | MEASURED |
| Broad date pages | until bounded date-window exhaustion | unchanged | MEASURED |
| Legacy shift after row 1,500 | visible | visible | MEASURED |
| Date-only legacy shift | visible | visible | MEASURED |
| Imported/restored legacy shift | visible | visible | MEASURED |
| Adjacent-month pay-period shift | visible | visible | MEASURED |
| Incomplete rescue warning | missing | visible with retry | MEASURED |

16.0.191 removes the redundant employeeId query fanout because the broad scheduleDateKey/date compatibility rescues must still run for date-only, scheduleDateKey-only, email, and safe-name historical rows. Firestore equality values for employeeId are no longer synthesized from scheduleUserId, authUid, uid, accountUserId, rosterUserId, or generic app ids. Exact employeeId values remain available for diagnostics/future indexed use without lowercasing.

## Refresh Brief

Refresh Brief keeps the 16.0.190 scoped behavior: only the `today-brief` cache scope is invalidated. Schedule and Team caches are retained, with 0 rereads caused by the Brief refresh.

## Deferred

A shared broad legacy rescue cache was intentionally deferred. Safe invalidation after schedule edits, publish, imports, and restores could not be proven locally without risking stale schedule visibility.
