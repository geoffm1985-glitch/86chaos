# 86 Chaos 17.0.17

## Bounded Git Status Recovery Repair

This release repairs the automatic installer failure observed while recovering a damaged checkout whose `.gitignore` was missing and whose existing `node_modules` tree therefore appeared untracked.

### Repair

- Repository safety inspection now asks Git for directory-level untracked reporting instead of recursively enumerating every file with `--untracked-files=all`.
- The Git helper has an explicit bounded 8 MiB output buffer as a secondary guard for legitimate large status output.
- Generated trees such as `node_modules/` continue to be preserved/ignored for pre-overlay source safety.
- Real untracked source files inside tracked source directories, such as `src/local-user-file.js`, are still reported and still block automatic overwrite.
- All 17.0.14 streaming/timeout/process-tree protections and the 17.0.15/17.0.16 damaged-checkout recovery protections remain intact.

### Regression evidence

`api/release-workflow-git-status-buffer-17-0-17.test.cjs` creates an actual temporary Git checkout with a missing `.gitignore` and a `node_modules` tree whose recursively enumerated porcelain status exceeds 1 MiB. It verifies that the production installer uses bounded directory-level reporting, restores the incoming release, preserves `.git`, and still refuses real untracked source.

Implementation and local source-level validation are not certification. 17.0.17 still requires a complete successful `npm run test:play-store` against the exact deployed testing candidate before promotion.
