# Scheduling phase test matrix

Every change requires both functional Playwright and canonical release-gate regression coverage. Targeted and delta results must belong to the current sealed candidate; inherited failures remain selected until repaired.

| Stage | Required coverage | Current result |
|---|---|---|
| Baseline | Complete source promotion, release identities, web/native isolation, production-token refusal, authenticated startup, retained scheduling, native contracts, complete discovery with stable spec identities | 19.0.2 accepted: sealed 44/44; local/deployed targeted 34/34 each; canonical delta 16/16; cleanup passed; exact commit/hash in implementation ledger. |
| 1 | Editor, weekly/mobile navigation, primary-grid move/copy/resize, keyboard/touch alternatives, sticky scrolling, undo/concurrency, retained views | 19.0.7 deployed targeted: 64 passed, 3 failed, 1 intentional desktop skip, 52 unrun; QA cleanup passed. Native desktop drag/drop passed both inventories. Local targeted/delta did not start. Dropdown specificity and offscreen touch-fixture targeting repaired for 19.0.8; 58 Node + 14 components + real Firestore preflight passed. Exact acceptance pending. |
| 2 | Hard/soft constraints, trustworthy inputs, deterministic draft generation, conflicts/repairs, templates, rescue duplicate claims, confidence-aware quality | Pending |
| 3 | Current competencies, collective station coverage, incomplete demand, owner wage boundaries, fairness, voice/typed approval | Pending |
| 4 | Availability approval/effective dates, swaps/trades/withdrawal, transactional claims, published acknowledgments, notification evidence, protected calendar updates/revocation | Pending |
| 5 | Exact publish scope, cancellation/history/restoration, retries/offline/lifecycle/session failures, 10–250 staff, application-wide parity/security/recovery | Pending |
| Final | All 29 requirements and phase gates complete; final targeted/delta pass; then canonical full gate and honest device acceptance | Deferred |

Targets include Windows Chrome/Edge, Android Chromium, iPhone WebKit, supported PWAs, emulator contracts and feasible native unit/instrumentation checks. Real devices and Apple build access require separate evidence. No phase command may invoke the full gate indirectly.
