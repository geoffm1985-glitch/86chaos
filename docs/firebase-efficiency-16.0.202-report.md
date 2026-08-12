# Firebase Read/Write Reduction Baseline from 16.0.174

Version: 16.0.203
Base: 16.0.174 rollback source

This release intentionally avoids another broad Firebase architecture rewrite. It keeps the stable 16.0.174 routing, Schedule, presence, and build behavior while trimming low-risk read demand.

## Changes

- Today roster cap: 90 -> 75, while Team remains 220.
- Today restaurant admin alerts: 30 -> 8, while non-Today admin/back-office remains 30.
- Today menu dependency summary cap: 120 -> 80, while full Menu Intelligence remains 500.
- HR Overview uses Firestore aggregate counts and lighter overview listener caps. Full HR detail tabs keep their higher caps.
- HR confidential performance notes load only when the Performance Notes section is opened.
- System Audit latest view now uses the latest 75 rows rather than 200.
- Existing safeWrite no-op protection and local Firebase diagnostics remain intact.

## Not changed

- No Schedule query/runtime rewrite.
- No Time Clock & Schedule navigation change.
- No Firebase rules/index/config changes.
- No dependency or Vite/build tooling changes.
- No Play Store/release-gate selection semantics changes.

Metrics above are source/test measurements, not production Firebase billing telemetry.
