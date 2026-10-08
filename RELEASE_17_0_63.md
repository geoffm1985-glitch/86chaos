# 86 Chaos 17.0.63 - Yardmaster Readiness Bootstrap Deadlock Repair

This testing build repairs the exact failed+new release-gate blocker captured in the Yardmaster handoff.

The local Yardmaster app was alive and the release preflight had already proved the `demo-86chaos` emulator target, but the dependency-install step required the readiness endpoint to be fully browser-SDK ready. That endpoint can legitimately return HTTP 503 while the browser-observed Firebase SDK is still starting or while Playwright browser installation is not yet complete. Because browser installation occurs later in the gate, the dependency step could deadlock the run before Playwright ever started.

17.0.63 separates two states without weakening the safety boundary:

- The local readiness endpoint now exposes a fail-closed bootstrap identity (`emulator`, `demo-86chaos`, live Firebase blocked) while full SDK readiness is pending.
- The dependency gate accepts only that exact HTTP 503 readiness-pending state and proceeds to the existing dependency preflight without running `npm ci` against the active Yardmaster app.
- Live targets, wrong projects, missing isolation proof, and unrelated HTTP failures remain blocked.
- Full browser-observed Firebase readiness remains required by the existing Yardmaster Playwright bridge regression before the emulator bridge is considered ready.

Adds targeted Node coverage and a mandatory Playwright release-gate regression for the exact pre-Playwright deadlock. Production routing and production Firebase behavior are unchanged. No production push is included.
