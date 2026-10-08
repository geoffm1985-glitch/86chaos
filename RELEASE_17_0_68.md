# 86 Chaos 17.0.68 - Failed+New Evidence Repair

This testing build repairs only the failure clusters proven by the Yardmaster 17.0.67 failed+new handoff. It does not push production.

The exhaustive surface matrix still expected a nested Prep control named exactly `Prep`, while the real rendered control is `Food Prep`. That stale declaration caused the route graph, all five responsive sweeps, and both accessibility sweeps to report the same false missing surface. The matrix now names the rendered control without removing any coverage.

The mobile Schedule Builder sticky assertion also measured the day/date strip against `.app-content-shell` even when CSS sticky positioning was governed by a nearer vertical scrollport. The regression now discovers and scrolls the actual nearest vertical scroll container, then evaluates sticky geometry against that same container.

The cost bug-ledger snapshot proved the application was authenticated and fully rendered, but the shared readiness helper rejected the compact header because it only recognized `Switch workspace` while mobile exposes `Active workspace …`. The helper now accepts that real authenticated control.

The Ghost Mode Request Off workflow completed successfully, but the audit problem collector treated the Firebase Auth emulator iframe's blocked `https://apis.google.com/js/api.js` CSP bootstrap as an application runtime failure. That exact cross-origin emulator-only CSP noise is now filtered while live mode, other URLs, and other CSP failures remain release blockers.

Finally, the mobile accessibility sweep had one isolated `Schedule Builder` discovery miss that did not reproduce in the stricter exhaustive route graph. Accessibility coverage now performs one real route remount and retries the original nested state before recording it missing; a second miss still fails the release gate.

Coverage added:

- Targeted Node/release-gate regression `api/release-gate-failed-new-evidence-17-0-68.test.cjs`.
- Mandatory Play Store/release-gate Playwright regression `tests/86chaos-release-gate/80-failed-new-evidence-17-0-68.spec.cjs`.
- Independent Playwright regression `tests/e2e/failed-new-evidence-17-0-68.spec.cjs`.
- Existing exhaustive, responsive, accessibility, Ghost Mode, sticky-header, and cost scenarios continue to exercise the repaired paths directly.
