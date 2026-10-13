# 18.0.15 mobile implementation completion

This release completes the known mobile implementation extensions authorized from the reconciled recommendation ledger. Web remains on its intentional 17.x line. Every APK uses production Firebase `cheers-34b8d`; every local test mutation uses the isolated demo emulators.

## Added behavior

- Published shift snapshots and immutable change events, current-version employee acknowledgment, reassignment recipients and manager notification evidence. Provider acceptance is distinguished from actual delivery and explicit acknowledgment. These records do not change pay or impose attendance penalties.
- Published shift cancellation preserves the last published snapshot, not later draft edits, and notifies both relevant recipient identities. Private notification tokens are redacted from public operation status.
- Immutable new food-safety readings; changed retry intent is rejected. Manager closure requires corrective action and a later safe check for the same item and limits. Audit export is bounded, paginated and includes record/closure integrity. Old reading values are preserved.
- Manager-observed role/station competency, separate from self-completed checklist evidence. Current evidence is rechecked, changed evidence is flagged, and revocation retains the original review. Self-certification is denied.
- Deterministic voice review destinations for safety, shifts, receiving, vendor aliases, waste, readiness, training and integration recovery. Pending commands are bound to actor/workspace/permissions/feature flags and a review window. Speech and typed fallback retain explicit business review controls.
- Durable Shift4 import operation identity, range lease, recovery checkpoints and transaction-level fencing against takeover/reconnection/location changes. A lost response can recover the recorded result; imported data remains staged. The provider's undocumented completion semantics remain unverified.
- Readiness source registry with missing, denied, stale, failed and truncated coverage. Existing bounded subscriptions are reused. New safety attention remains unresolved until closure, including beyond the current day.
- Security Center uses trusted shared platform authority and Firebase Auth MFA enrollment evidence. Profile MFA flags cannot establish protection. Bounded or failed enrollment lookups remain unknown. API enforcement, console enforcement, deployed rules and external acceptance are distinct evidence.
- Local release runtime source/commit/version pinning and source-change rejection. Mutable build metadata from a separate build cannot silently change the running release identity. A new full gate must start a fresh pinned local app.
- Supported dependency patches and maintained development/build consumers, with ordered middleware compatibility and explicit unresolved upstream advisory tracking. No blanket dependency-safety claim is made.

## Preserved foundations

Existing purchasing/receiving/invoice/stock/menu propagation, graph provenance and allergens, reviewed demand forecasts, POS staging/PCI limits, backups/recovery, MFA/App Check guards, presence/lifecycle costs, native speech/location/PDF/reminders, notification branding and release accounting remain mandatory regression coverage.

## Acceptance and release workflow

New business/authorization/stale/retry/immutability/connection-fence/component tests and real desktop/mobile browser flows are added to the canonical release universe. Full server/client/rules/build/native prerequisites remain required. QA cleanup includes the new private evidence collections and verifies their absence.

Source must be sealed, committed and pushed before tests. No GitHub Actions are authorized. Focused regressions precede one visible local canonical full gate. Once its actual full Playwright worker executes test bodies, start evidence is saved and the same monitor is paused; the full run is left untouched.

## External acceptance

Geoff deferred live POS account setup and USB Android acceptance. Production console MFA/App Check/rules, credential exposure audit and real restore acceptance require their own verified evidence. Provider ticket completeness needs a documented/verified contract. These are not fabricated by local browser or fixture results.

Validation status: pending execution on the sealed pushed release.
