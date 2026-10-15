# 86 Chaos engineering requirements

The authorized scheduling rebuild starts at 19.0.0 on testing, promoted from the complete mobile source. This program explicitly overrides earlier web candidate numbering. It does not authorize native distribution or any production deployment.

All application capabilities must retain equivalent business functionality on Android APK, Android/iPhone web, Windows Chrome/Edge, supported desktop PWAs, and native iOS when the Apple toolchain is available. Every feature change requires a parity assessment, functional Playwright regressions and canonical release-gate regressions. Hardware adapters need honest supported fallbacks. Browser emulation is never physical-device evidence.

Use shared deterministic business logic and protected data services. Preserve tenant authorization, owner-only wages, MFA/App Check, audit, immutable published history, backups, POS read-only boundaries and existing features. Require revision checks, idempotency and authoritative success evidence for consequential writes. All consequential AI commands require preview and approval.

For baseline and phases 1–5: implement → local preflight → version bump → seal/commit → push testing → verify deployment → targeted → delta → repair/repeat → advance only after pass. Inspect command dependencies before execution. Never launch the full gate before all five phases and final targeted/delta validation pass. Never replace missing lineage with an early full run or stale passes.

Tests and gates run locally. Playwright and Play Store tests run in visible PowerShell windows under the established Yardmaster protocol. No GitHub Actions, including automatic push triggers. Keep mobile/main/experimental unchanged. Testing web/API uses chaos-test-d1601; every APK uses cheers-34b8d, retained signing identity and production API destinations. No testing-Firebase APK or production APK publication.

Keep source immutable while a test run is active. Evidence belongs to an exact commit, source hash, version, environment and platform. Preserve current failure and lineage evidence; apply authorized result retention only after live-process and lock checks. Do not claim delivery, synchronization, device acceptance or certification without evidence.

Acceptance checklist: current source and build identities agree; environment and authorization checks pass; relevant business workflows and fallback paths pass; retries/concurrency/offline failures are covered; existing functionality remains discoverable; all three program documents reflect actual evidence and limitations.
