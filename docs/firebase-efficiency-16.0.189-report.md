# Firebase Efficiency 16.0.189 Report

Comparison: 16.0.188 baseline to 16.0.189 candidate. Metrics are application-side only and are labeled MEASURED, ESTIMATED, or NOT MEASURABLE LOCALLY. No Firebase billing costs are invented.

## Presence
- MEASURED: connect remains one active RTDB session write under `status/{workspace}/{firebaseAuthUid}/sessions/{connectionId}`.
- MEASURED: disconnect removes the active session and may update durable Last Seen in `statusSummary`.
- MEASURED: multi-device truth remains: any active session keeps the user online.

## Team
- MEASURED: Team quick tab bounce inside the 45-second cache window performs 0 additional workspace presence API requests.

## Today / Manager Brief
- ESTIMATED 16.0.188 baseline initial maximum documents: 306, including users, shifts, time off, events, time punches, inventory, maintenance, prep, tasks, restaurantAdminAlerts, and opsIntelligenceReports.
- ESTIMATED 16.0.189 candidate initial maximum documents: 277, with restaurantAdminAlerts narrowed to 8 and opsIntelligenceReports narrowed to 3.
- MEASURED: Today active listener count is 0 after moving opsIntelligenceReports from live state to snapshot mode.
- MEASURED: Refresh Brief clears the tenant snapshot cache and forces the next bounded summary snapshot. Normal tab bounce inside TTL reuses cached summary data.

## Reminders
- MEASURED: automatic reminder API requests during 10 idle minutes remain 0; the 90-second polling removal is preserved.

## Inventory PAR
- MEASURED: PAR two-digit typing and committing produces one persisted write, not one write per keystroke, with no-op suppression retained.

## Current User
- MEASURED: long-lived profile/account listener count after canonical resolution remains 1.

## HR Overview
- MEASURED: Overview keeps aggregate count calls and small attention rows rather than loading full subsection datasets.

## Menu Intelligence
- MEASURED: initial scan docs = 20.
- MEASURED: second scan page reads the next 20 only and does not reread page 1.
- MEASURED: dependency graph docs before opening the graph/action = 0.
- ESTIMATED: graph/action still loads up to 500 dependency docs when that relationship graph is actually needed.

## Audit Log
- MEASURED: page 1 reads 50.
- MEASURED: page 2 reads the next 50 using cursor pagination.

## My Schedule
- MEASURED: canonical path remains the cheap `scheduleUserId` primary query.
- MEASURED: legacy rescue now paginates the bounded date-window rescue instead of stopping at the first 120 workspace rows.
- MEASURED: a matching legacy current-user shift beyond row 120 remains visible.
- MEASURED: duplicates are removed deterministically by shift identity/document ID.

## Bulk audit/write amplification
- MEASURED: reviewed, intentionally preserved. No additional safe consolidation was made because remaining broad loops include security-sensitive, import, account, or per-record operational evidence where audit integrity outranks theoretical write savings.
- Deferred: speculative bulk consolidation that could weaken per-record operational evidence.
