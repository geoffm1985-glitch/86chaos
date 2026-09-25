# 86 Chaos 17.0.21

## Release Gate Direct Playwright Process Repair

The 17.0.20 full Play Store gate completed every release-readiness check before the mobile layout smoke, then the Windows child process produced no Playwright test output and remained alive until the 180-second watchdog terminated it.

17.0.21 changes only that release-harness boundary. The same required five-case mobile layout suite now launches the locked local Playwright CLI directly from the release-check runner with `process.execPath`, `shell: false`, and the same 180-second process limit. This removes the extra Node watchdog process while preserving the actual browser assertions and deterministic timeout classification.

Application behavior, Schedule Builder, schedule publishing, POS Bridge, Firebase rules, permissions, and restaurant data paths are unchanged.
