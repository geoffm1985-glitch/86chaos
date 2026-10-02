# 86 Chaos 17.0.57 — Yardmaster Firebase emulator bridge

Repairs Yardmaster's missing `yardmaster.firebase.json` error and supplies the
required local startup/readiness contract. The root bridge uses the existing
five-service Firebase configuration, demo project and complete gate scripts.

Yardmaster's pinned emulator target overrides stale live environment settings;
its launcher maps service endpoints for the browser. Local readiness observes
the actual bundled Firebase SDK and refuses incomplete or unavailable services.
A local browser connection policy blocks live Firebase endpoints.

Adds the exact Node regression, critical Play Store inventory entry, regression
registry record and focused desktop/Android Playwright coverage. The focused
runner starts real local Firebase services and never invokes the full gate.

All current version surfaces advance to 17.0.57. Production routing, rules and
release-gate inventories are preserved. No manual deployment is required for
this local bridge; the commit is pushed only to `testing`.
