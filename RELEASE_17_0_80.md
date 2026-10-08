# 86 Chaos 17.0.80 — Completed Full Failure-Lineage Recovery

This build repairs the exact failed+new baseline rejection that remained after 17.0.79.

The saved 17.0.77 full gate is proven complete Playwright evidence: it reached report collection and produced 509 results with 19 unexpected failures. Its source/runtime identity was 17.0.77 / 17.0.76. That mismatch must not be promoted to release-certification parity when the stronger runtime-equivalence proof is unavailable, but the 19 observed failures must also not be discarded.

The repair separates those two concepts:

- Exact-version and explicitly proven runtime-equivalent baselines retain normal baseline behavior.
- The exact `17.0.77|17.0.76` completed run may be reused only as `full-failure-lineage` when it contains real unexpected Playwright failures.
- A mismatched run with zero unexpected failures is still rejected.
- Unrelated source/runtime mismatches remain rejected.
- Current target source/deployed parity, production-target refusal, and release certification checks remain unchanged.
- Adds targeted Node, Play Store/release-gate Playwright, and independent Playwright regression coverage.

No production push is authorized by this build.
