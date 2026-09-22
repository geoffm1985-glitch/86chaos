# 86 Chaos 17.0.20

## Release Gate Source Validator Contract Repair

The 17.0.19 full Play Store gate reached hostile certification and stopped before Playwright because `api/release-gate-execution-17-0-5.test.cjs` still required the exact console phrase `source validation passed`. The current 17.0.19 source validator completed successfully but reports `expected-version pinning validation passed`, so the test rejected correct behavior because human-readable wording changed.

17.0.20 repairs only that release-gate test contract. The hostile regression now proves the mandatory source validator ran by checking the structured `preflight-test-start.json` evidence (`group`, `command`, `started`, `exitCode`, target URL, and certification flag) and the stable preflight launch marker. It no longer treats a validator's prose success sentence as part of the executable contract.

The 17.0.19 expected-version pinning repair and the 17.0.18 schedule/mobile-layout subprocess separation remain intact. Schedule Builder, schedule publishing, POS Bridge, Firebase rules, permissions, and restaurant data behavior are unchanged.
