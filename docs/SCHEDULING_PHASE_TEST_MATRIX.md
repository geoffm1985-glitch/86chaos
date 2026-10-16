# Scheduling phase test matrix

Every change requires both functional Playwright and canonical release-gate regression coverage. Targeted and delta results must belong to the current sealed candidate; inherited failures remain selected until repaired.

| Stage | Required coverage | Current result |
|---|---|---|
| Baseline | Complete source promotion, release identities, web/native isolation, production-token refusal, authenticated startup, retained scheduling, native contracts, complete discovery with stable spec identities | 19.0.2 accepted: sealed 44/44; local/deployed targeted 34/34 each; canonical delta 16/16; cleanup passed; exact commit/hash in implementation ledger. |
| 1 | Editor, weekly/mobile navigation, primary-grid move/copy, time editing, keyboard/touch alternatives, sticky scrolling, undo/concurrency, retained views | 19.0.14 deployed targeted passed 155/156 with one intentional skip and all 84 Phase 1 workflows; cleanup passed. Both local attempts ended 110 passed, three timeouts, one intentional skip, 48 unrun of 162. Second cleanup passed. Preparing 19.0.15 nonlocking authoritative read snapshots with concurrency/snapshot regressions. Exact preflight, local/deployed targeted and canonical delta pending. Production forbidden; native backend/device acceptance deferred. |
| 2 | Hard/soft constraints, trustworthy inputs, deterministic draft generation, conflicts/repairs, templates, rescue duplicate claims, confidence-aware quality | Pending |
| 3 | Current competencies, collective station coverage, incomplete demand, owner wage boundaries, fairness, voice/typed approval | Pending |
| 4 | Availability approval/effective dates, swaps/trades/withdrawal, transactional claims, published acknowledgments, notification evidence, protected calendar updates/revocation | Pending |
| 5 | Exact publish scope, cancellation/history/restoration, retries/offline/lifecycle/session failures, 10–250 staff, application-wide parity/security/recovery | Pending |
| Final | All 29 requirements and phase gates complete; final targeted/delta pass; then canonical full gate and honest device acceptance | Deferred |

Targets include Windows Chrome/Edge, Android Chromium, iPhone WebKit, supported PWAs, emulator contracts and feasible native unit/instrumentation checks. Real devices and Apple build access require separate evidence. No phase command may invoke the full gate indirectly.
# 19.0.13 repair preparation evidence

19.0.12 deployed targeted `phase1-targeted-deployed-20261015-144011` passed 155/156 with one intentional desktop mobile-only skip, zero failures/timeouts/unrun and all 84 Phase 1 identities passing; authoritative cleanup passed. Local startup-only attempt `phase1-targeted-local-20261015-163050` failed before provisioning/cases. The unchanged warmed candidate's local run `phase1-targeted-local-20261015-164636` selected 162: 32 passed, three failed, one intentional skip, 126 unrun, zero timeouts; authoritative cleanup passed and all validation processes exited. Delta remains unrun.

The three failures reproduced a concurrent explicit tour-skip/header-dismissal helper race. `api/audit-dialog-dismissal-19.test.cjs` adds actual Chromium contracts for concurrent dismissal, ordinary closure, preserving a replacement consequential dialog, a blocked original control, and unknown action errors. The original helper failed the race/replacement cases; the repaired four-case iteration passed. Expanded preflight initially passed 120/121 Node checks; the fifth fixture threw through an out-of-band Playwright callback and was corrected to inject the unknown failure at the awaited close-action boundary. All five corrected actual-browser contracts passed (`phase1-dialog-contracts-20261015-170940`). Final preflight `phase1-component-20261015-171027` passed 121 Node checks, 21 React tests and real Firestore, zero failures/skips, with emulator shutdown and all process exits. Both existing functional inventories retain all business assertions and original limits. Fresh 19.0.13 acceptance is required after sealing; diagnostic/helper checks do not constitute phase acceptance.
# 19.0.14 scoped preflight

Corrected complete-validator regressions passed 5/5. Final scoped preflight `phase1-component-20261015-192612` passed 126 Node checks, 21 React tests and the real Firestore integrity scenario with zero failures/skips, followed by isolated emulator shutdown and all process exits at 2026-10-16T00:29:49Z. Fresh sealed 19.0.14 local/deployed targeted and canonical failed+new delta acceptance remain pending; no full gate or Phase 2 advancement occurred.

# 19.0.15 read transaction regressions

Both actual read APIs blocked concurrent mutation under read/write transactions; explicit read-only controls committed without changing the reader snapshot. New Node and isolated real Firestore regressions cover both ID and complete-week reads. All browser business assertions and original limits remain mandatory. Phase 1 is not accepted.

Final scoped preflight `phase1-component-20261016-002538` passed 128 Node checks, 21 React tests and all three isolated real Firestore scenarios with zero failures/skips, followed by emulator shutdown and all preflight process exits at 2026-10-16T05:29:17Z. The two new real Firestore regressions confirmed concurrent mutation and original-snapshot consistency. Exact sealed 19.0.15 APK/deployment/targeted/delta acceptance remains pending.


## Candidate 19.0.16: local emulator watch lifecycle

Candidate 19.0.15 local targeted validation failed: 162 selected, 129 passed,
3 timed out, 1 intentional skip, 29 unrun; its authoritative QA cleanup failed.
Its deployed targeted run passed 155/156 with one intentional mobile-only skip.
The original failure, cleanup failure and subsequent 1536 MiB emulator OOM remain
preserved; the OOM does not establish the cause of every earlier timeout.

An independent matched workload reproduced reload-specific emulator retention:
241 real authenticated scheduling operations and 40 Edge full-app reloads retained
288,558,320 bytes versus 4,798,264 without reloads. Waiting for pending writes,
disabling the network and a one-second delay still retained 290,203,128 bytes.
That failed control was rejected. Explicit React unmount and shared listener
release, with real removeTarget forwards acknowledged HTTP 200 before navigation,
completed the same 241 operations/40 reloads and owned-record cleanup at
2026-10-16T12:05:34Z; retained heap grew 18,607,256 bytes (27,053,784 to 45,661,040).
Original assertions, API operations, CAS/tenant/privacy controls and timeouts stay.

The repair installs a guarded demo-86chaos/loopback/fail-closed lifecycle only in
emulator builds. Local browser fixtures settle writes, unmount listeners and wait
for observed per-channel target removal plus successful transport acknowledgments
before explicit navigation and page teardown. Live/testing-cloud and production
native Firebase do not acquire this hook. Unknown failures remain fatal; no sleep,
network disabling, test retries or runtime exception broadening is introduced.
New canonical and functional local contracts require actual observed targets and
authoritative scheduling readiness after reload. The original 84 Phase 1 workflow
identities remain, with 12 additional local lifecycle cases across the six engines.

19.0.16 scoped preflight, signed production APK, exact testing deployment,
targeted/delta validation and acceptance remain pending. No full gate or production
deployment. Native backend/device and real Safari acceptance remain deferred.

19.0.16 scoped preflight `phase1-component-20261016-072626` completed at 2026-10-16T12:30:05Z: 134 Node checks (including six lifecycle regressions), 21 React tests and three real Firestore scenarios passed; zero failures/skips. Actual isolated Firestore/hub/logging shutdown and all validation exits verified. Discovery requires all 84 original workflows plus 12 new local lifecycle cases (96 total, eight per wrapper/project). The initial obsolete 84-total inventory assertion failure is preserved, then strengthened to include the new cases. Signed APK, exact deployed/local targeted and delta acceptance remain pending.
