# 86 Chaos 17.0.77 — Server Certification Drift Repair

This build repairs six stale server-side certification assertions exposed by the 17.0.76 full Yardmaster gate. Runtime behavior is unchanged.

- Historical hostile-manifest coverage invokes the current source validator instead of pinning 17.0.70.
- Schedule Builder tab certification tolerates stable test-ID attributes while retaining role/aria/title semantics.
- Warnings certification follows `schedule-copilot-warnings-tab`.
- The Yardmaster dependency installer remains the owner of the 30-minute observable `npm ci` timeout.
- Coverage certification counts the duplicate Chuck row once while retaining Chuck and Lani as two distinct bartenders.
- Spanish certification validates the reusable language helper and still explicitly selects Spanish.
- Adds Node, Play Store/release-gate, and independent Playwright regressions.

No production push is authorized by this build.
