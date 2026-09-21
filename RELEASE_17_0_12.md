# 86 Chaos 17.0.12

Release: Schedule Publish Candidate Repair and PWA Gate Hardening

## Surgical repair

- Schedule Publish now builds its final confirmation set from authoritative Firestore server reads before sending evidence to `/api/schedule-publish`. This prevents mobile cache/local-echo rows from creating the `candidate_set_changed` failure shown as “The saved schedule changed or the candidate query is incomplete.”
- Intentional open shifts remain publishable without forcing an employee match, while linked employee shifts still fail closed when the employee cannot be resolved.
- The PWA icon metadata matrix no longer asks Playwright to launch a browser page for a metadata-only assertion. It fetches the app shell, manifest, and icon bytes through request fixtures so a late Firefox binary launch failure cannot block the release gate.

## Guardrails preserved

- The server-side candidate set, role revision, shift fingerprint, lease, commit, and verification checks remain intact.
- No schema migration, permissions change, POS change, PDF change, payroll change, or unrelated tab behavior change is included.
