# 19.0.1 — testing baseline repair

Live-project bearer tokens now receive HTTP 403 before Firebase Admin initialization in isolated emulator mode. The shared browser regression opens Schedule Builder through the existing Schedule screen and explicit builder control, preserving the required workflow assertions.

The 19.0.0 local compatibility run retained 22 passes and 8 failures across the two shared causes; its QA cleanup passed. The corrected selector and focused Firebase/server-boundary tests pass (20 tests, zero skips). Deployment and targeted/delta acceptance for this candidate remain required before Phase 1.

Geoff authorizes Phase 1 automatically after baseline acceptance, then requires a stop before Phase 2. No APK link may be delivered until Phase 1 and its targeted/delta checks pass. No APK is built or published by this repair; production and other branches remain unchanged. The full release gate remains deferred until all five phases are complete.
