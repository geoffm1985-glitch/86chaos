# 86 Chaos 17.0.58 - Failed+New Emulator Target Coherence Repair

This testing build repairs the exact false-negative exposed by the 17.0.57 failed+new release gate.

- `playwright.failed-release.config.cjs` now applies the same canonical Firebase target normalization as the full Play Store/release-gate config before Playwright evaluates test expectations.
- The 17.0.54 Firebase bridge regression now resolves the selected target through the shared target helper, so a Yardmaster-selected EMULATOR run is not incorrectly asserted as LIVE merely because one CRA environment key is absent in the test process.
- The historical System Administrator safeguard regression no longer pins the entire application to version 17.0.52. It continues to verify the actual safeguards on later builds.
- Adds a targeted Node regression plus critical Play Store/Playwright coverage, including the PWA/mobile-WebKit path used for iPhone coverage.

Application Firebase runtime behavior is unchanged. EMULATOR remains loopback-only, fail-closed and pinned to `demo-86chaos`; LIVE remains the default outside an explicit emulator selection. No production push is included.
