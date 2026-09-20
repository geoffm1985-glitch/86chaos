# 86 Chaos 17.0.18

## Release Gate Baseline Restoration and Playwright Start Repair

This release repairs the release-gate architecture after the 17.0.17 full-gate run spent 32m 37s in local readiness checks and never started the actual Playwright release suite.

### Root causes confirmed from 17.0.17 evidence

- `api/release-gate-execution-17-0-5.test.cjs` still hardcoded `17.0.11 source validation passed`, so a valid 17.0.17 source-validation result failed a historical regression.
- `npm run test:schedule-publish` launched a second standalone Playwright process (`playwright.layout.config.cjs`) before the real release Playwright gate. Its Node/Jest checks passed, but the standalone Playwright child hung on Windows until the 20-minute release-check timeout killed it.
- The pre-Playwright release-check phase had grown from the proven 16.0.235 baseline into a second large certification universe with hostile, emulator, recovery, scale, server, client, build, and browser work. Any stale local regression could therefore prevent the full deployed browser suite from starting.

### Repair

- Pre-Playwright local readiness is reduced to bounded source validation and syntax checks. Deployment identity, test-account/role validation, dependency/browser readiness, and immutable target pinning remain mandatory preconditions.
- The full Playwright release universe runs next against the exact immutable deployment.
- Heavy hostile, emulator, schedule publication, recovery, scale, server, client, production-build, Java, and canonical rules checks run after Playwright and remain mandatory for final certification. A post-Playwright failure blocks certification but is no longer mislabeled as `BLOCKED BEFORE TEST EXECUTION`.
- The mobile 86Voice geometry regression is part of the main Playwright universe and runs once under Chromium. `test:schedule-publish` no longer launches its own nested Playwright process.
- The stale 17.0.11 assertion now follows the actual current package version.
- Long release-check commands retain a larger diagnostic tail so failure extraction can report the real failing test/assertion instead of a trailing source-manifest fragment.
- All 17.0.14 streaming/heartbeat/timeout/process-tree cleanup and 17.0.15-17.0.17 safe automatic ZIP-recovery behavior remains intact.

Implementation and local validation do not certify 17.0.18. Certification still requires the complete `npm run test:play-store` run against the exact deployed testing candidate, including both the Playwright phase and mandatory post-Playwright certification checks.
