# Scheduling phase test matrix

Every change requires both functional Playwright and canonical release-gate regression coverage. Targeted and delta results must belong to the current sealed candidate; inherited failures remain selected until repaired.

| Stage | Required coverage | Current result |
|---|---|---|
| Baseline | Complete source promotion, release identities, web/native isolation, production-token refusal, authenticated startup, retained scheduling, native contracts, complete discovery with stable spec identities | 19.0.2 accepted: sealed 44/44; local/deployed targeted 34/34 each; canonical delta 16/16; cleanup passed; exact commit/hash in implementation ledger. |
| 1 | Editor, weekly/mobile navigation, primary-grid move/copy, time editing, keyboard/touch alternatives, sticky scrolling, undo/concurrency, retained views | 19.0.11 deployed targeted: 123 passed, 3 failed, 0 timeouts, 1 intentional skip, 27 unrun of 154; authoritative cleanup passed. Local/delta did not run. Unsealed 19.0.12 repairs Firefox revision regression and Request Off test state leakage. Final expanded preflight 142528: 116 Node, 21 React, real Firestore passed with shutdown; all 18 affected helper-location checks retained and passing. Strengthened dismissal diagnostic 122513: 4/4 desktop/Android cases and cleanup passed, not sealed acceptance. Narrow WebKit engine classification authorized and guarded; corrected-source preflight passed, exact acceptance pending. Production deployment explicitly deferred; native/device acceptance unresolved. |
| 2 | Hard/soft constraints, trustworthy inputs, deterministic draft generation, conflicts/repairs, templates, rescue duplicate claims, confidence-aware quality | Pending |
| 3 | Current competencies, collective station coverage, incomplete demand, owner wage boundaries, fairness, voice/typed approval | Pending |
| 4 | Availability approval/effective dates, swaps/trades/withdrawal, transactional claims, published acknowledgments, notification evidence, protected calendar updates/revocation | Pending |
| 5 | Exact publish scope, cancellation/history/restoration, retries/offline/lifecycle/session failures, 10–250 staff, application-wide parity/security/recovery | Pending |
| Final | All 29 requirements and phase gates complete; final targeted/delta pass; then canonical full gate and honest device acceptance | Deferred |

Targets include Windows Chrome/Edge, Android Chromium, iPhone WebKit, supported PWAs, emulator contracts and feasible native unit/instrumentation checks. Real devices and Apple build access require separate evidence. No phase command may invoke the full gate indirectly.
