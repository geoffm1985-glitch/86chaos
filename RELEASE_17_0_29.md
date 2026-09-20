# 86 Chaos 17.0.29 — Time Clock and Schedule Parent Route Recovery

## Root cause

The last known-good 16.0.227 `TabMasterSchedule` parent route entered its React hooks immediately and did not execute Schedule Builder or Request Off runtime sanitizers just to open My Schedule / Time Clock. The same parent boundary was still present in 17.0.24, where the failure was limited to Schedule Builder and Request Off.

17.0.25 broadened the failure by eagerly normalizing roster, shifts, events, Request Off rows, shift swaps, and availability at the top of `TabMasterSchedule`. That made every Time Clock & Schedule subtab depend on the new safety layer before the active subtab was known. The later 17.0.26–17.0.28 module/export repairs did not remove this architectural regression, so a safety-layer runtime problem could still send the entire parent route to the recovery boundary.

## Repair

17.0.29 restores the known-good lazy parent boundary. The parent route accepts the live collections without executing Schedule Builder / Request Off sanitizers. Defensive normalization remains localized to Schedule Builder, Request Off, and Availability when those subtabs are actually selected.

## Targeted validation only

This release intentionally does **not** run the 282-test Play Store gate in the automated workflow. It runs only:

- the dedicated parent-boundary source regression;
- one dedicated React parent-route regression file;
- the production build;
- one deployed mobile-Chromium Playwright test that opens Time Clock & Schedule and fails if the recovery screen appears.

Full certification can be run later after the real-device regression is confirmed fixed.
