# Daily briefing and weekly review: verified feature status

Reviewed October 8, 2026 against `testing` 17.0.84, commit `425b2e9442171654ad78f360c0521327b258326a`. [feature-status.json](feature-status.json) records source paths, coverage, remaining work, branch/version references, and certification evidence. Recheck those references before every briefing; this is a dated inventory, not a live certification claim.

## What already exists

Shared needs-attention, Restaurant Readiness, the connected restaurant knowledge graph, Operational History, purchasing reconciliation, and predictive Smart Prep have shipped code foundations. Do not describe them as absent or propose rebuilding them. Track their unfinished connections and workflow validation separately.

| Capability | Verified implementation | Remaining work |
| --- | --- | --- |
| Needs-attention and Readiness | Shared deterministic cards, category scoring, review actions | Complete source coverage, permissions, and completeness validation |
| Restaurant knowledge graph | Menu, recipe, inventory, vendor/product, invoice, cost relationships | Validate downstream changes after reviewed receiving/approval |
| Operational History | Bounded operating-event trends and training opportunities | Readiness and errors are empty inputs; receiving history is not connected |
| Predictive Smart Prep | Comparable-weekday demand, current prep/waste adjustment, insufficient-data handling | Dependable item-level mapping and a history window spanning enough comparable days |
| Purchasing reconciliation | Deterministic discrepancy classification and invoice review navigation | Full approval, idempotent inventory/cost changes, recipe costing, menu impact, and recovery proof |
| Forecast-aware Schedule Copilot | Existing scheduling tools and separate intelligence foundations | Complete forecast-to-date/role recommendation workflow |
| Training/Time Clock awareness | HR tools, Time Clock, and operational training foundations | Connected coaching and clock-anomaly review workflows |

## Certification truth

The latest complete recorded full run, `2026-10-07T13-36-35`, tested 17.0.84 at `c62c206eceb7fefffc8b000ecb516c05902da4b9`: **581 PASS, 0 FAIL, 0 TIMEOUT, 12 expected SKIP, 0 unexpected SKIP**. Its final result is **FAILED**, because the mandatory real-device group has no valid source-bound evidence. It also predates the latest Schedule Builder fixes. The current testing source has no qualifying full certification in the evidence reviewed here.

Passing targeted tests, the presence of code, and the absence of failing browser tests do not establish certification. Keep the [standing rule in issue #175](https://github.com/geoffm1985-glitch/86chaos/issues/175) intact unless Geoffrey explicitly changes its sequencing requirement. Physical-device evidence cannot be inferred from desktop/mobile browser tests.

## Branch and APK context

The reviewed production reference is `main` 17.0.84 at `ab4a848058902672ee8f5114710a6af0db71a2c0`. The [18.0.11 preview APK](https://github.com/geoffm1985-glitch/86chaos/releases/tag/mobile-v18.0.11-preview) is on `mobile` at `61540afd7eab9863514f16bd2faa8e3ec7da71c4`. Its production Firebase/API configuration and signing certificate were verified in conversation `01a11a3f-9706-7173-ab80-f0679d56f5bc`.

The requested implementation scope is **testing**. APK version 18.0.11 does not identify the testing web build. Shared production data does not update the APK's packaged frontend; later web changes need a separate tested mobile release.

## Briefing/review format

For each future daily briefing or weekly competitive review:

1. Identify the branch, version, exact source commit, and reviewed deployment. Report APK context separately.
2. Classify each capability as absent, foundation present, expansion needed, or implemented. State certification independently.
3. Cite the real source and behavior coverage before marking an implementation complete. A navigation/render assertion is not proof of a full business transaction.
4. State the current full-gate result, exact tested source, expected/unexpected skips, and unresolved blockers. Do not carry an older pass forward onto changed source.
5. Advance unfinished connections and genuinely new recommendations. Preserve completed foundations and the backlog's review/permission boundaries.

Scheduled briefing prompts were not available through the connected tools in this session. This inventory and the linked backlog are the references those prompts should consult; their schedules or prompts have not been changed.
