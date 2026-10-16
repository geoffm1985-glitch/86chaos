# 86 Chaos 19.0.14 — native release identity guard

Android and iOS native contract version names and codes now match the package and actual native project metadata. Pre-push validation rejects a stale nested identity even when the root release number is correct. Five regressions exercise the complete validator with coherent inputs and each native name/code independently stale; existing validation and business assertions remain intact.

19.0.13 passed all 84 Phase 1 browser workflow identities but failed two native metadata checks. Candidate 19.0.14 requires fresh scoped preflight, signed APK verification, testing deployment identity, local/deployed targeted and canonical delta acceptance. Native backend/device acceptance remains deferred. No production deployment, GitHub Actions, Phase 2 advancement or full gate occurred.
