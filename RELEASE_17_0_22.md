# 86 Chaos 17.0.22

## Hermetic Local Regression Environment Repair

This is a surgical release-workflow repair after the real Windows/Node 24 one-paste updater stopped at `current release regression tests` even though 17.0.21 had already isolated one synthetic collector fixture.

### Confirmed remaining weakness

17.0.21 isolated deployment identity inside the synthetic collector helper, but the outer `npm run test:repair` process could still inherit stale state from an earlier release-gate attempt. That state included release run IDs/directories, step-failure counters, QA mutation flags, strict Vercel workspace diagnostics, Vercel process identity, test account values, and Firebase test selectors.

A regression suite must not change behavior because the parent PowerShell session previously ran or failed a release gate.

### Repair

- `test:repair:17.0.22` now routes the entire repair universe through a dedicated Node child-process runner.
- The runner copies the normal operating-system environment, removes known release-gate/QA/deployment/test-state variables, removes Node's private test-context marker, then starts the Node test runner without a shell.
- The one-paste updater performs the same cleanup as defense in depth before local release validation.
- A permanent 17.0.22 regression launches a real child test with polluted release-workflow state and proves the child sees a clean test environment while retaining normal OS variables such as `PATH`.
- 17.0.21 synthetic collector isolation remains in place.

### Preserved behavior

No production application workflow, Firebase project selection policy, collector certification semantics, Playwright ordering, security boundary, POS behavior, schedule behavior, or data mutation path was changed.

17.0.22 is not certified by this repair. Certification still requires the complete deployed `npm run test:play-store` gate against the exact immutable 17.0.22 testing candidate.
