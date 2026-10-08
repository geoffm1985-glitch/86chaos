# 86 Chaos 17.0.52

## System Administrator Firebase Cost Diagnostics Runtime Repair

17.0.52 is a surgical repair for the failed 17.0.51 failed+new release gate. The deployed System Administrator route entered App Recovery with `TypeError: ut is not a function` while React was evaluating a `useMemo` in the System Administrator component. The failing render path is the Firebase / RTDB cost-observability calculation.

The browser surface was importing `firebaseCostDiagnostics.cjs` through default CommonJS interop. 17.0.52 keeps the existing CommonJS helper for Node-side tests, adds a browser-native ES module with the same bounded aggregate calculation, and changes only the System Administrator browser import to the named ES-module export.

Coverage added:
- Targeted Node/release-gate contract proving the System Administrator browser source no longer imports the CommonJS diagnostics helper and that the callable diagnostics contract remains intact.
- Playwright regression that opens System Administrator, enters Security Center, requires the Firebase / RTDB Cost Observability panel to render, and rejects the exact `ut is not a function` / `not a function` recovery signature on desktop and mobile.

Production is unchanged. No restaurant workflow, Firebase rule, Storage rule, or data schema behavior is changed by this repair.
