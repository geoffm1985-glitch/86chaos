# 86 Chaos 17.0.81 — Lazy Chunk Failure-Injection Fidelity Repair

This build repairs the primary saved-full failure rerun by correcting the test harness, not the production recovery path.

The 17.0.80 failed+new Playwright attachment recorded `abortedUrl` as `http://127.0.0.1:3000/static/js/bundle.js`. That is the CRA development boot bundle, not a lazy feature chunk. Aborting it prevents React from mounting at all, which explains the empty body, absent recovery state, and zero recovery events observed in both Chromium projects. The previous release-gate matcher therefore created the blank page it was trying to detect.

The repair is deliberately narrow:

- The stale-chunk fault injector now delegates to a shared classifier that accepts only JavaScript assets ending in `.chunk.js` under `/static/js/`.
- `bundle.js`, `main*.js`, `runtime-main*.js`, CSS, service workers, and other boot assets are never eligible for injected failure.
- The existing stale-chunk browser certification now asserts that its intercepted URL is a true lazy chunk and is not a boot bundle.
- Production chunk-recovery implementation in `src/App.js` is unchanged.
- Adds targeted Node, Play Store/release-gate Playwright, and independent Playwright regression coverage for the exact historical `bundle.js` misclassification.

The saved full-gate failure lineage remains intact. This build is intended for the next failed+new/delta rerun, not production deployment.

No production push is authorized by this build.
