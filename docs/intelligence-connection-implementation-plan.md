# Testing intelligence work: implementation and acceptance criteria

Scope: items 3 and 4 from conversation `01a11a3f-9706-7173-ab80-f0679d56f5bc`, implemented on `testing`. The October 2 review's original text was not recovered; the scope below uses the explicit recommendations in that conversation. No experimental or mobile code import is required.

Feature implementation remains subject to the certification sequence recorded in issue #175 until Geoffrey explicitly changes it. This plan records unfinished work; it does not claim the workflows are implemented.

## Operational History connections

- Replace the empty readiness/error inputs and connect receiving evidence. Use actual workspace-scoped, bounded records; show unavailable, loading, error, and truncated states.
- Record readiness observations with a documented timestamp, source IDs, completeness, and explicit permission checks. Avoid automatic repeated writes on every render.
- Normalize real error evidence without including credentials, raw request headers, or another employee's private data. Avoid treating current memory-only diagnostics as historical records.
- Add targeted and Release Gate/Play Store tests for repeated-cause trends, retention, timestamp normalization, workspace changes, access denial, missing sources, and listener cleanup.

## Dependable Smart Prep history

- Define an item-level sales contract containing workspace, business date, stable menu/recipe mapping, quantity/unit, source identity, and completeness.
- Load a bounded historical window spanning enough comparable weekdays; the current-month aggregate sales listener is insufficient for many early-month forecasts.
- Resolve only unambiguous menu-to-recipe relationships. Preserve invalid/missing/partial data as insufficient evidence, distinguish real zero sales, and deduplicate ingestion retries.
- Validate independent weekday samples, date/timezone boundaries, item mappings, negative/refund quantities, missing pages, stale history, no-op reviews, tenant isolation, and permissions on desktop/mobile.
- Keep POS ingestion staged/read-only. No implicit change to inventory, recipes, orders, or prep from a forecast.

## Purchasing and costing workflow validation

- Exercise real reviewed invoice matching and approval, unit/case/catch-weight conversion, exactly-once stock and cost updates, then recipe yield/portion cost and menu impact.
- Verify unauthorized, duplicate, low-confidence, incomplete receiving, failed transaction, retry, and cross-workspace paths leave state correct.
- Add business-value assertions to targeted coverage and the full browser gate; opening the invoice screen alone does not verify this workflow.
- Require human review for ambiguous matches and consequential writes. Keep ordering, accounting posting, and payment outside this scope.

## Forecast-aware Schedule Copilot

- Present explainable date/role coverage recommendations from valid, sufficiently fresh demand evidence and manager-configured coverage. Include baseline, comparable samples, expected demand, confidence, and reason.
- Avoid invented staffing ratios or changing existing targets automatically. When demand or staffing configuration is insufficient, show the missing input.
- Preserve availability, Request Off, active employee identity, role eligibility, schedule completeness, and labor constraints.
- Recommendations require review before draft creation; publication continues through the existing review/publish flow.
- Test missing/stale/partial forecasts, period boundaries, coverage scaling, conflicts, access denial, duplicate/no-op actions, and desktop/mobile parity in targeted and full-gate coverage.

## Training and Time Clock awareness

- Turn repeated operational causes and readiness gaps into evidence-linked, role-specific training review. Connect review to existing HR workflows through explicit manager action.
- Derive Time Clock findings from real shift/punch identities and dates, accounting for overnight shifts, incomplete punch data, open breaks, and attendance policy.
- Restrict employee-specific findings to authorized managers and HR permissions. Keep unknown data explicit; avoid labeling loading or missing records as employee misconduct.
- Never auto-assign coaching, alter punches, publish schedules, or affect payroll.
- Test repeated-cause evidence, role/workspace isolation, employee mapping, open/closed punches, overnight shifts, missing data, review navigation, and mobile/desktop access parity.
