# 86 Chaos engineering requirements

The authorized scheduling rebuild starts at 19.0.0 on testing, promoted from the complete mobile source. This program explicitly overrides earlier web candidate numbering. Geoff now authorizes signed APK previews from testing, built before targeted/delta validation and linked immediately after verified upload. APK availability does not establish acceptance. Any production website or production-backed API deployment requires separate authorization.

All application capabilities must retain equivalent business functionality on Android APK, Android/iPhone web, Windows Chrome/Edge, supported desktop PWAs, and native iOS when the Apple toolchain is available. Every feature change requires a parity assessment, functional Playwright regressions and canonical release-gate regressions. Hardware adapters need honest supported fallbacks. Browser emulation is never physical-device evidence.

Use shared deterministic business logic and protected data services. Preserve tenant authorization, owner-only wages, MFA/App Check, audit, immutable published history, backups, POS read-only boundaries and existing features. Require revision checks, idempotency and authoritative success evidence for consequential writes. All consequential AI commands require preview and approval.

For baseline and phases 1–5: implement → local preflight → version bump → seal/commit → push testing → verify deployment → targeted → delta → repair/repeat → advance only after pass. Inspect command dependencies before execution. Never launch the full gate before all five phases and final targeted/delta validation pass. Never replace missing lineage with an early full run or stale passes.

Tests and gates run locally. Playwright and Play Store tests run in visible PowerShell windows under the established Yardmaster protocol. No GitHub Actions, including automatic push triggers. Keep mobile/main/experimental unchanged. Testing web/API uses chaos-test-d1601; every APK uses cheers-34b8d, retained signing identity and production API destinations. No testing-Firebase APK or production APK publication.

Keep source immutable while a test run is active. Evidence belongs to an exact commit, source hash, version, environment and platform. Preserve current failure and lineage evidence; apply authorized result retention only after live-process and lock checks. Do not claim delivery, synchronization, device acceptance or certification without evidence.

Acceptance checklist: current source and build identities agree; environment and authorization checks pass; relevant business workflows and fallback paths pass; retries/concurrency/offline failures are covered; existing functionality remains discoverable; all three program documents reflect actual evidence and limitations.

Geoff permits automatic Phase 2 work after all required exact-candidate Phase 1 targeted/delta tests and acceptance pass. Stop before Phase 3 without further authorization. Monitor active targeted/delta validation every 15 minutes; preserve source and reports until validation and authoritative QA cleanup finish. No full gate during these phases.

Declare Playwright tests in their .spec files. Shared helpers may export scenario bodies but must not register tests under helper locations. Canonical discovery must reject unrecognized declarations or a parsed count that differs from Playwright's reported total. Confirm every new case has a unique spec/suite/title/project identity in the actual CLI inventory, not just successful direct execution.

Scheduling verified reads: a stalled client watch may use the protected bounded read-week operation, with the same tenant/schedule/App Check/MFA/environment boundary. Keep point-in-time API verification distinct from connected live updates; fence actor/week/generation, expire freshness, invalidate offline/background evidence, preserve a labeled preview, and never turn read recovery into queued or automatic mutations. Keep functional blocked-watch coverage in both browser and release-gate inventories.

Test transport and lifecycle: independent read-only verification may use bounded connection-reset recovery; never turn this into automatic mutation retries or HTTP-error suppression. Do not emit authenticated Playwright request headers or raw transport errors in reports/console output. Wait for an actual login/workspace surface before deciding a hydrated session is authenticated. Keep consequential end-to-end workflows independently bounded without raising limits or omitting assertions. If a failed test is partitioned, preserve its exact browser/source failure lineage by selecting every replacement workflow; reject incomplete or ambiguous migration. Native drag tests must verify trusted gestures, the app payload at dragstart and actual reviewed business results, accounting for browser native-bridge serialization.

Scheduling deletion overlays are render-only revision/timestamp evidence. Never derive mutation authority or automatic delete retries from cached/live rows, localStorage or storage events. Versioned legacy delete requests must retain original reviewed CAS evidence and reject newer restorations. Repeated delete/Undo/Redo/Undo must preserve latest notes and immutable history. WebKit Firebase transport is isolated in firestorePlatformTransport; the pinned SDK useFetchStreams option requires installed-SDK effective-settings and actual browser transport/reload regressions on every SDK upgrade. Never suppress an application page error to certify navigation. Geoff explicitly authorized separately recording only the reproduced Windows WebKit engine navigation-cancellation event; the exact-version, verified-read, explicit-reload/pre-document-commit and no-application-ErrorEvent guards are covered by actual loopback WebKit tests. All other errors and business assertions remain fatal, classified events remain visible in reports, and real Safari/device acceptance remains pending.

Production deployment is explicitly deferred unless separately authorized by Geoff. Native production API absence is recorded as pending native acceptance; testing web/API validation proceeds against chaos-test-d1601 with isolated native contracts/mocks. Never deploy production to unblock a testing phase.


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


## Candidate 19.0.17: acknowledge the initial emulator listen session

19.0.16 deployed targeted passed 168 selected: 155 passed, 13 intentional skips,
zero failures/timeouts/flaky/unrun; all original 84 Phase 1 workflows and QA cleanup
passed. Local targeted failed: 174 selected, one passed, three ordinary failures,
zero test timeouts/flaky/intentional skips, 170 unrun. Its authoritative QA cleanup
passed; all tests and cleanup exited. Canonical reports/media, clean start/end
source, verified hash chain and original failure are preserved outside the source.
No delta ran; 19.0.16 is not accepted.

Actual failed-run network captures show the first addTarget(2) is sent without a
SID. Its HTTP 200 length-prefixed connect frame assigns a SID; subsequent commands
and removeTarget(2) use that assigned SID and are acknowledged HTTP 200. The 16
fixture incorrectly kept the initial target under an empty SID. All three failed
traces include that phantom target; the first also reports login readiness failure,
so its original result remains failed rather than being retroactively dismissed.

17 maps provisional targets only through the actual acknowledged connect frame.
Later removals cannot be resurrected if response-body delivery races them; distinct
channels with the same target ID remain isolated. Missing, malformed or ambiguous
handshakes and non-200 acknowledgments remain fatal. All source lifecycle guards,
business assertions, timeouts, case inventories and runtime classifications stay.

Three sanitized captured-protocol replays, delayed-body/removal ordering, overlapping
channels and malformed-handshake regressions faithfully failed before the fix:
six pass/six fail. Corrected tracker passed all 12 checks. New real client-SDK
contracts exercise acknowledged initial watch/unsubscribe on Chromium, mobile
Chromium, Edge, Firefox, WebKit and mobile WebKit using owned demo Auth/Firestore
records, with required record/Auth/SDK/browser/server cleanup. Scoped preflight
(140 Node + six SDK/browser contracts + 21 React + three real Firestore scenarios),
seal, signed production APK and exact deployed/local targeted/delta acceptance are
pending. No full gate or production deployment. Native backend/device/real Safari
acceptance remains deferred.

19.0.17 scoped preflight `phase1-component-20261016-102745` completed at 2026-10-16T15:32:06Z: 140 Node checks, six actual authenticated SDK/browser watch/unsubscribe contracts, 21 React tests and three real Firestore scenarios passed; zero failures/skips. Owned Auth/Firestore records, SDK/browser/server shutdown, isolated Firestore/hub/logging shutdown and all validation process exits were verified. Source tested before final documentation was `f0aee145f70b451b3694af32e8bfb4400a16736efcd9fc6089e79099961d3884`; the final manifest includes these evidence notes. Signed APK and exact deployed/local targeted/delta acceptance remain pending.


## Candidate 19.0.18: release real local listener targets before offline faults

19.0.17 deployed targeted passed: 168 selected, 155 passed, 13 intentional skips,
zero failures/timeouts/flaky/unrun; all 84 original Phase 1 workflows and cleanup
passed. Local targeted failed: 174 selected, 36 passed, three ordinary failures,
one intentional skip, 134 unrun; zero test timeouts/flaky. Its authoritative QA
cleanup passed. Canonical reports/media, exact clean start/end source and final
hash chain are preserved. No delta ran and 17 remains unaccepted.

Actual failed traces show offline reconnects abandon previously accepted watch
targets. An isolated official-emulator control left 12 targets and queued 485 more
messages after 20 writes. An experimental close-callback shadow jar only halved
the leak and was rejected; the official emulator remains unchanged. Public SDK
unsubscribe/HTTP200-remove acknowledgment before offline, then resubscribe to the
same references/callbacks, produced zero orphan targets and zero message growth
on all six browser configurations, with owned cleanup and all process exits.
The first standalone WebKit fixture omitted the app's existing transport selector
and also failed reattachment while online. Both WebKit controls passed with the
actual existing forced-long-polling/XHR selector; the original failure is retained.

18 tracks public onSnapshot subscriptions only on fail-closed loopback/demo mode.
The local fixture settles writes, pauses real subscriptions without unmounting
React, waits original-limit removeTarget HTTP200 acknowledgments, performs the
same offline toggle, then resumes identical callbacks/options. Live/native paths
retain the original SDK function. Explicit read-listen fault setup drains existing
targets before installing the original abort. Only the exact successful fixture
abort of add-only read commands can discard never-accepted adds. Unknown aborts,
non-200 replies, malformed/ambiguous handshakes and every unacknowledged removal
remain fatal; later successful commands cannot be erased by earlier aborts.

Seven registry/lifecycle and seven strict-abort regressions passed with the 12
existing protocol guards (26 total). Both local functional/canonical lifecycle
contracts now verify actual offline invalidation and authoritative restoration
before their existing reload checks across six engines. All 84 original business
identities/assertions/timeouts remain unchanged; the inventory remains 96 Phase 1
identities, deployed 168/local 174 selected. Real SDK preflight loads the actual
candidate registry and existing canonical transport selector in all six engines.
Full scoped preflight (154 Node, six real SDK/browser contracts, 21 React and three
real Firestore scenarios), seal, signed production APK, testing release and exact
deployed/local/delta acceptance are pending. No full gate or production deployment.
Native backend/device and real Safari acceptance remains deferred.

19.0.18 scoped preflight `phase1-component-20261016-143458` completed at 2026-10-16T19:39:37Z: 154 Node checks, six actual authenticated SDK/browser registry watch/pause/offline/resume contracts, 21 React tests and three real Firestore scenarios passed; zero failures/skips. Owned Auth/Firestore records, SDK/browser/server cleanup, isolated Firestore/hub/logging shutdown and all validation process exits were verified. Source tested before final documentation was `0e402506d4c8fe9a7ae76682121ed7a699a08ae8235ed8677a716abc2f189677`; the final manifest includes these evidence notes. Signed APK and exact deployed/local targeted/delta acceptance remain pending.
