# 86 Chaos 17.0.62 - Root Source Archive Boundary Repair

This testing build repairs the remaining Git/ZIP source-manifest mismatch exposed after 17.0.61.

- The failing Windows checkout contained `86chaos-17.0.57-EXACT-FAILED-SOURCE.zip`, an old root-level Yardmaster/source handoff archive that was not present in the sealed application ZIP.
- Certification source identity now excludes root-level `86chaos-*.zip` and `86chaos_*.zip` source/build handoff artifacts.
- Real untracked, non-ignored repair source files remain included before Git indexing, preserving the 17.0.60 protection.
- Nested ZIP files remain eligible application source, so an intentional runtime asset cannot be hidden by the artifact rule.
- Git branch, commit, dirty-tree, and packaged-manifest certification checks remain unchanged.
- Adds exact Node release-gate and Playwright regressions for the checkout-only stale source ZIP parity failure.

Application runtime behavior is unchanged. Firebase LIVE/EMULATOR routing is unchanged. No production push is included.
