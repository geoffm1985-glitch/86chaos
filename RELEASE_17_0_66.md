# 86 Chaos 17.0.66 - Failed+New Suite-Path Canonicalization Repair

This testing build repairs the exact blocker captured in the latest Yardmaster handoff without changing product runtime behavior or pushing production.

The 17.0.65 retired-title alias was correct for the leaf test title, but the carried failed Playwright lineage has a historical suite path shaped as `86chaos-release-gate\56-manager-brief-sticky-day-header.spec.cjs > 56 Manager Brief runtime + sticky Schedule Builder day header`. Current inventory reports only the describe suite path. Because 17.0.65 compared those suite strings literally, the explicit migration did not activate and the safety validator correctly blocked before Playwright.

17.0.66 canonicalizes only the first suite segment when it normalizes to the same spec path already selected. The known retired title can then reconcile to the current truthful title. A different spec prefix, a different suite, project, retired title, or replacement title is not accepted and continues to fail closed.

Coverage added:

- Targeted Node regression using the exact Windows-path lineage shape from the handoff, plus a mismatched-prefix negative case.
- Mandatory Play Store/release-gate Playwright regression for the same lineage shape.
- Independent Playwright regression extending the existing lineage-migration suite.

No production push or deployment is included.
