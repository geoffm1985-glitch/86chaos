# 86 Chaos 19.0.2 — testing baseline discovery repair

Promotion regressions now declare tests directly in the Playwright and release-gate spec files. Shared scenario bodies preserve the same identity, authenticated scheduling and environment refusal checks. Canonical discovery rejects unrecognized test declarations and mismatched totals instead of silently omitting cases.

Both browser inventories include a regression for fail-closed discovery. Real CLI discovery must include all 16 promotion case/project/spec combinations with distinct identities. Canonical targeted prerequisites include the inventory unit and CLI regressions.

19.0.1's selected delta passed 79/79 and its local/deployed targeted runs passed 30/30 each with cleanup. Its discovery gap prevented baseline acceptance. This candidate requires fresh targeted/delta evidence before Phase 1 starts. No full gate, production deployment or APK distribution is authorized by this release.
