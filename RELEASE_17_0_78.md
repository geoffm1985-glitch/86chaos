# 86 Chaos 17.0.78 — Yardmaster Emulator Browser Fidelity Repair

This build repairs browser-certification drift exposed when 17.0.77 reached the full Playwright phase for the first time in the current repair chain.

- Live candidates still require HTTPS, HSTS, an active service worker, and a real Chromium system-notification round trip.
- The managed `demo-86chaos` emulator instead certifies its explicit HTTP loopback, blocked-live Firebase target, `worker-src 'none'`, and no production service-worker registration.
- Local Yardmaster responses now carry the non-transport browser security headers that are meaningful on HTTP loopback; HSTS remains a live-deployment requirement.
- Reminder and Request Off tests wait for their exact listener-backed row before asserting mobile UI state.
- Mobile System Administrator cost capture opens **Show directory** before selecting Support Diagnostics when required.
- Single-workspace cost capture treats the shipped Active workspace control as a legitimate no-op instead of requiring a switcher that the app intentionally does not render.
- Sticky Schedule Builder certification scrolls far enough to displace the compact deck without leaving the sticky header's containing block.
- The 17.0.77 source-contract regression now uses semantic assertions instead of brittle exact source formatting.
- Adds dedicated Node, Play Store/release-gate Playwright, and independent Playwright regression coverage.

No production push is authorized by this build.
