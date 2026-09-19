# 86 Chaos 17.0.15

**Release:** Automatic ZIP Extraction and Damaged Checkout Self-Heal Repair

## Purpose

Surgical updater repair after the 17.0.14 one-paste workflow stopped before installing the release because the existing checkout was missing `package.json`. The workflow had attempted to inspect the old checkout before extracting and validating the incoming complete release ZIP, so a damaged working tree could not self-heal.

## Repairs

- Extracts and validates the incoming app-only ZIP before reading the existing checkout version.
- Uses Git HEAD as a recovery version baseline when the working-tree `package.json` is missing.
- Allows a complete manifest-verified release snapshot to recover across interrupted intermediate patch releases within the same release line.
- Restores missing manifest-tracked application files from the incoming release while preserving `.git`.
- Refuses automatic recovery when modified tracked files, untracked user files, or other meaningful edits are present.
- Verifies the repository reports the expected new version immediately after overlay before running npm validation or build steps.
- Prints an explicit confirmation that the ZIP was extracted and installed into the repository.
- Preserves the 17.0.14 streamed release-check output, heartbeat, bounded timeouts, controlled hostile concurrency, and descendant-process cleanup.

## Preserved behavior

This release does not weaken Firebase, Vercel identity, tenant isolation, repository safety, or release certification. It preserves the Schedule Builder runtime repair, stable Firebase Auth testing referrer, exact deployment identity verification, one-paste commit/push workflow, live Play Store progress, slim evidence export, and persisted total elapsed time.

## Certification status

Implementation and local source-level validation are not release certification. 17.0.15 still requires a complete successful `npm run test:play-store` against the exact deployed testing candidate before promotion.
