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
