# 86 Chaos 17.0.13

**Release:** Idempotent Automated Release Resume Repair

## Scope

Surgical workflow repair after the 17.0.12 one-paste updater stopped before installation because the repository already reported 17.0.12 and the workflow incorrectly demanded 17.0.13.

## Root cause

The updater assumed every run must start from exactly one patch version behind the ZIP. An interrupted/manual overlay can legitimately leave the working repository at the requested release version before commit/push. The workflow treated that resumable state as an invalid future-version condition. Its installer also treated a coherent, manifest-identical interrupted candidate as arbitrary dirty user work.

## Repair

- Accepts either the immediately preceding version (normal upgrade) or the requested version (resume) as a valid starting state.
- Before overlaying a dirty repository, validates the existing candidate against its own bundled release-source manifest and refuses any mismatch or unmanifested dirty path.
- Allows a coherent interrupted candidate to be safely resumed without weakening dirty-repository protection.
- Removes only stale source files proven to belong to the verified prior manifest and absent from the incoming manifest.
- Verifies the repository against the incoming manifest after overlay.
- Keeps Git metadata, Firebase/Vercel security boundaries, deployment identity, Schedule Builder behavior, and full-gate-only user testing unchanged.

A complete full Play Store release gate is still required before certification.
