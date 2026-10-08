# 86 Chaos 17.0.59 - Release-Gate Staleness and Manifest Parity Repair

This testing build repairs the two deterministic failures reported by the 17.0.58 failed+new gate.

- The historical 17.0.56 Firebase entrypoint regression now derives the active validator filename from `package.json` instead of requiring `validate-17-0-57.js` forever.
- The bundled `release-source-manifest.json` is regenerated only after the complete repaired 17.0.59 source is finalized, restoring exact certification-source parity.
- Adds a targeted Node release-gate regression and a permanent Playwright regression that both cover validator-version staleness and bundled source-manifest parity.
- The targeted testing workflow explicitly includes the new Playwright regression.

Application runtime behavior is unchanged. Firebase LIVE/EMULATOR routing is unchanged. No production push is included.
