# 86 Chaos 17.0.20

## Bounded Actionable Failure Evidence Repair

This is a surgical release-gate repair of 17.0.19 based on Astra's confirmed hostile-review findings in `createActionableFailureCapture()`.

### Confirmed defects repaired

- Routine expected Firebase `PERMISSION_DENIED` diagnostics can no longer fill the entire actionable-failure window and erase a later real assertion or fatal error.
- Actionable evidence is priority-aware: real test/fatal failures displace lower-value context while expected rule-denial diagnostics are retained separately in a small bounded diagnostic window.
- Partial-line state is bounded and copied away from oversized parent strings, preventing newline-free child output from retaining multi-megabyte chunks through V8 sliced-string references.
- Recent context, deduplication keys, diagnostic evidence, partial-line storage, and final evidence are all explicitly bounded.
- Chunk-boundary recognition is preserved, including assertion tokens split between child-process output chunks.
- A nonzero command containing only a Firebase permission-denial diagnostic remains actionable instead of being silently discarded as harmless. Successful commands still return an empty `firstUsefulFailure`.

### Preserved release-gate architecture

17.0.20 does not redesign production behavior or certification policy. It preserves the 17.0.19 order:

1. Dependency, deployment, Firebase, and account preconditions.
2. Bounded source/version, API/script syntax, and Python readiness.
3. Main full Playwright release universe.
4. Mandatory hostile, concurrency, recovery, scale, server, client, build, Java, Firestore, and Storage certification checks.
5. Cleanup, final identity verification, fail-closed report collection, and final verdict.

The main Playwright universe, full-universe reconciliation, retry accounting, stable Firebase Auth referrer, testing-project mutation boundary, immutable deployment identity, same-version resume, Windows/POSIX child-tree cleanup, and full-gate-only user workflow are unchanged.

17.0.20 is not certified by implementation or targeted validation. Certification still requires a complete successful `npm run test:play-store` against the exact immutable deployed 17.0.20 testing candidate with every mandatory evidence group green.
