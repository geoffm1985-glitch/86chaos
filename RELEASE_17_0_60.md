# 86 Chaos 17.0.60 - Git/ZIP Source Inventory Parity Repair

This testing build repairs the deterministic source-manifest mismatch reported by the 17.0.59 failed+new gate.

- Source identity now inventories the same application workspace files in a Git checkout and a Yardmaster ZIP overlay instead of switching to `git ls-files` only when `.git` is present.
- Local-only `.npmrc` is excluded from the application source fingerprint so preserving local config cannot invalidate a packaged certification manifest.
- Git commit, branch, and dirty-working-tree checks remain separate and unchanged, so full certification still requires committed, clean source.
- Adds targeted release-gate and Playwright regressions that reproduce the Git/ZIP inventory split and prove real application-source drift is still detected.

Application runtime behavior is unchanged. Firebase LIVE/EMULATOR routing is unchanged. No production push is included.
