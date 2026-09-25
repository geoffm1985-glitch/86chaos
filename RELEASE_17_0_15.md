# 86 Chaos 17.0.15

## Schedule Publish Canonical Roster Parity Repair

This release changes only the remaining schedule-publish mismatch path plus required version/test metadata.

The server-side publisher previously resolved employees only from canonical `workspaceMembers` plus a narrow migration fallback. Schedule Builder could still correctly resolve active tenant users that had not yet been represented by `workspaceMembers`. That difference made the client confirm a shift while the server classified the same shift as unresolved, producing the `candidate_set_changed` 409 shown as “The saved schedule changed or the candidate query is incomplete.”

17.0.15 uses active users from the same restaurant as identity-only fallback evidence when no canonical workspace member has claimed them. This does not grant application permissions or change authorization. Canonical workspace members still win when present.

The server also no longer aborts the entire publication merely because the client confirmed an extra shift that the authoritative server will not write. It still fails closed if the server intends to write any shift that the client did not confirm, and unchanged authoritative rows still receive fingerprint validation.
