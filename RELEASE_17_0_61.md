# 86 Chaos 17.0.61 - Ignored Local Source Boundary Repair

This testing build repairs the remaining source-manifest mismatch exposed after 17.0.60.

- In a Git worktree, certification source identity now uses tracked files plus untracked files that are **not** ignored by Git.
- Git-ignored machine-local files remain outside the packaged application fingerprint, so preserved Windows/Yardmaster local state cannot make the checkout differ from the sealed ZIP.
- Newly overlaid Yardmaster repair files are still included before Git indexing, preserving the protection added in 17.0.60.
- ZIPs without `.git` metadata continue to use the deterministic package-filesystem inventory.
- Git branch, commit, and dirty-tree certification checks remain unchanged.
- Adds exact Node release-gate and Playwright regressions for the ignored-local-file parity failure.

Application runtime behavior is unchanged. Firebase LIVE/EMULATOR routing is unchanged. No production push is included.
