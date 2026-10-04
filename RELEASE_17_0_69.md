# 86 Chaos 17.0.69 - Source Manifest Authority Repair

## Captured failure
The failed+new gate stopped before browser execution because the bundled source manifest and the completed source tree disagreed. Both failures were exact inverses of the same two hashes. File-level comparison isolated the drift to `scripts/86chaos-release-gate/failed-only-manifest-utils.cjs`.

The current source contains newer failed+new lineage/source-file-hash logic that was not present when the 17.0.68 manifest was sealed. Reverting that logic would discard current source. The surgical repair therefore preserves it and reseals release identity only after the complete 17.0.69 source tree and tests are finalized.

## Repair
- Bump the testing build to 17.0.69.
- Preserve the current `failed-only-manifest-utils.cjs` behavior unchanged.
- Regenerate `release-source-manifest.json` from the final completed 17.0.69 source tree.
- Add an exact regression for the manifest row that drifted plus whole-tree manifest parity.
- Keep historical 17.0.31/17.0.59 source-integrity assertions fail-closed.

## Coverage
- Targeted Node/release-gate regression: `api/release-gate-source-manifest-authority-17-0-69.test.cjs`.
- Mandatory Play Store/release-gate Playwright regression: `tests/86chaos-release-gate/81-source-manifest-authority-17-0-69.spec.cjs`.
- Independent Playwright regression: `tests/e2e/source-manifest-authority-17-0-69.spec.cjs`.

No production push or deployment is included.
