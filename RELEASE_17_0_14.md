# 86 Chaos 17.0.14

**Release:** Release Check Streaming, Timeout, and Orphan Process Repair

## Purpose

Surgical release-gate infrastructure repair after the 17.0.13 full Play Store attempt appeared permanently frozen during hostile certification and left orphaned Playwright child processes after the parent release-check runner exited.

## Repairs

- Replaces silent unbounded `spawnSync` execution of release-check groups with streamed child-process execution.
- Prints live stdout/stderr immediately and emits a periodic heartbeat showing group name, elapsed time, no-output duration, and configured timeout.
- Adds bounded timeouts to every required local release-check group.
- On timeout or interruption, terminates the complete descendant process tree rather than only the immediate shell process.
- Stops the remaining local readiness sequence after a required timeout/interruption and records the remaining groups as not run.
- Runs hostile Node contract tests with `--test-concurrency=1` for predictable Windows behavior instead of launching many filesystem/Git-heavy tests concurrently.
- Adds regression coverage proving live streaming, heartbeat behavior, bounded timeout, nested child cleanup, controlled hostile concurrency, pager-free automation, and the full-gate-only user workflow.

## Preserved behavior

This release does not weaken application, Firebase, tenant, Vercel identity, or certification security behavior. It preserves the prior Schedule Builder runtime repair, stable Firebase Auth testing referrer, immutable deployment identity verification, manifest-safe repository updater, automatic ZIP extraction, automatic commit/push, Vercel wait verification, live Playwright progress, slim evidence export, and persisted total release-gate timing.

## Certification status

Implementation and local source-level regressions are not release certification. 17.0.14 still requires a complete successful `npm run test:play-store` against the exact deployed testing candidate before it can be certified or promoted.
