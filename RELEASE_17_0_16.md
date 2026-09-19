# 86 Chaos 17.0.16

**Release:** Generated Artifact-Aware Checkout Recovery Repair

## Purpose

Surgical updater repair after the 17.0.15 one-paste workflow reached the repository install stage but refused recovery because the damaged checkout was missing `.gitignore`. Git therefore exposed the existing generated `node_modules` tree as untracked `??` content, and the installer incorrectly treated those dependency files as meaningful user source.

## Repairs

- Classifies only **untracked** release-forbidden local/generated artifacts as safe-to-preserve recovery state. This includes `node_modules`, build/test output, `.vercel`, `.firebase`, local `.env*` files, logs, local release ZIPs, and other paths a valid app-only release ZIP is forbidden from containing.
- Keeps modified/deleted tracked source and untracked overwriteable source as hard blockers.
- Allows the incoming manifest-verified ZIP to restore `.gitignore`, `package.json`, the release manifest, and other missing tracked application files while preserving `.git`.
- Leaves generated dependency/local configuration state untouched during overlay; the existing `npm ci` stage remains responsible for rebuilding `node_modules` after the source snapshot is installed.
- Adds an actual temporary-Git damaged-checkout regression with missing `.gitignore`, missing tracked source, populated `node_modules`, local environment state, and an incoming 17.0.16 release snapshot.
- Preserves every 17.0.14 and 17.0.15 workflow repair: streamed release-check output, heartbeat, bounded timeouts, whole-process-tree cleanup, controlled hostile concurrency, extraction-before-inspection, Git HEAD recovery baseline, exact deployment verification, and full Play Store gate only.

## Safety boundary

The recovery exemption applies only to **untracked paths that the validated app-only ZIP is forbidden to contain or overwrite**. Real untracked source and tracked edits still stop the automation before overlay.

## Certification status

Implementation and local source-level validation are not release certification. 17.0.16 still requires a complete successful `npm run test:play-store` against the exact deployed testing candidate before promotion.
