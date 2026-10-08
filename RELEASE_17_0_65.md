# 86 Chaos 17.0.65 - Failed+New Lineage Identity Migration Repair

This testing build repairs the exact blocker captured in the Yardmaster handoff without changing product runtime behavior or pushing production.

The failed+new gate stopped before Playwright because a previously failed mobile Schedule Builder test still existed in lineage under its pre-17.0.64 title, while 17.0.64 correctly renamed that test to describe the repaired compact behavior: the control deck scrolls away and the day/date header remains pinned. The safety validator refused to silently discard the old identity.

17.0.65 adds one explicit retired-identity migration for that exact spec, suite, project, old title, and current title. The prior failure reason remains attached to the migrated current identity. Unknown or unrelated missing Playwright titles are not migrated and continue to fail closed.

Coverage added:

- Targeted Node regression for the exact old-title to new-title migration and the fail-closed negative case.
- Mandatory Play Store/release-gate Playwright coverage for the failed mobile lineage.
- Independent Playwright regression coverage in the e2e inventory.

No production push or deployment is included.
