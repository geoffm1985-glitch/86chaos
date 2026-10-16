# 86 Chaos 19.0.16 — Phase 1 preview

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
