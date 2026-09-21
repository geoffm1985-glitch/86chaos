# 86 Chaos 17.0.14

## Schedule Publish Authoritative Evidence Repair

This release is limited to the two reported failures plus required release/version wiring.

### Schedule publishing

The publish flow now reads the selected shift candidates from Firestore's server-authoritative view before confirmation. It sends confirmed evidence for both shifts that need writes and shifts already validly published in the selected scope. The server still writes only stale/draft/repair candidates and still fails closed if a writable server candidate is missing, if extra evidence is not an authoritative unchanged shift, or if any confirmed shift changed before commit.

Intentional open shifts remain publishable without inventing an employee identity. The 17.0.12 canonical identity parity repair is retained.

### PWA failed test

The PWA icon matrix validates only HTML/manifest/icon metadata, so it no longer launches a Firefox page at all. The temporary Firefox-only retry is removed. The assertions themselves remain intact.

### Validation

Targeted server regressions, source validation, syntax checks, manifest verification, and repeated targeted runs are required before packaging. This is not a full Play Store certification run.
