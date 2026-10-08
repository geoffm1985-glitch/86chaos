# 86 Chaos 17.0.64 - Emulator Release-Gate Cascade Repair

This testing build repairs the concrete failures captured in the Yardmaster failed+new handoff without changing production routing or pushing production.

The evidence showed a cascade rather than dozens of independent product failures: the Storage emulator readiness probe called `/` and generated HTTP 501 noise, Firestore 10.14.1 then surfaced `INTERNAL ASSERTION FAILED: Unexpected state` behind the CRA runtime overlay during emulator stress, Request Off fixture cleanup still required the live testing project `chaos-test-d1601` even when the selected target was `demo-86chaos`, and a later max-767 CSS rule re-stuck the Schedule Builder control deck after the compact layout had intentionally changed it to scroll away. The Spanish Preferences failure also captured a one-time workspace/profile hydration remount that returned Settings to Profile immediately after the click.

17.0.64 makes only the affected boundaries target-aware and internally consistent:

- Storage emulator readiness uses the existing bucket-list endpoint instead of the unsupported emulator root.
- Emulator Firestore is memory-only; LIVE keeps the existing multi-tab IndexedDB/offline persistence path.
- Request Off fixture reset derives its expected project from the explicit Firebase target and retains all current-run/project/document safety checks.
- Compact/mobile Schedule Builder leaves the control deck in normal flow and keeps only the day/date strip sticky; desktop keeps the sticky control deck.
- The Spanish Preferences regression re-issues the same Preferences activation if workspace hydration remounts Settings, but still requires the language control and all translation assertions.
- New 17.0.64 Node/release-gate and mandatory Playwright coverage locks these boundaries.

No production push or deployment is included.
