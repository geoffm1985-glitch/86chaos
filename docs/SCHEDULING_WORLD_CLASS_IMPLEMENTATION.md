# Scheduling rebuild implementation ledger

## Promoted baseline — 19.0.0

- Original testing: 17.0.86 / cc153755c074bda8c0e7d4e3d4642c0248d4f8cb.
- Complete mobile foundation: 18.0.19 / f9e20e876b11de41ea8f1037fa4117f7ab9bf5a5; verified fast-forward, 224 commits.
- Recovery reference: recovery/testing-before-19-20261014. External incremental bundle requires the preserved parent 6eac007fce509f9f83f26dfb40e0049249064ced.
- Existing systems retained: Schedule Copilot, demand forecasts, templates/coverage, publication fences, acknowledgment evidence, verified competencies, Capacitor native adapters, and all other application modules.
- Added: fail-closed testing/native resource boundary and production-token rejection on testing; testing defaults pinned before generic credentials; mismatched Admin credential, Storage and RTDB destinations refused; manual-only GitHub workflow configuration; inherited universal parity and phase sequencing requirements.
- Local preflight: current-release targeted unit/component/emulator checks, API syntax (803 files), and optimized web build passed on 2026-10-14 (host evidence: baseline-preflight-20261014-192716). Subsequent Admin boundary correction passed 24 focused Firebase/credential/server-boundary regressions. Final source validation is recorded with the sealed candidate; the earlier preflight hash is not deployed acceptance evidence.
- Browser targeted/delta/deployment results: pending. No full gate authorized until phase 5 completion.
- Physical Android and native iOS acceptance: pending, never inferred from browser emulation.

## Phase progression

Geoff authorizes automatic Phase 1 advancement after baseline acceptance. Complete Phase 1 and its required repairs and validation, then stop before Phase 2 until explicitly authorized. No APK link may be delivered until Phase 1 acceptance passes.

### Baseline repair candidate — 19.0.1

- Baseline 19.0.0 deployed successfully as 80b5a2be1796d7bd105f007b12ca57e3439c5f5e, Vercel dpl_BGE1MMU1CtH5hUUaz4yFW2jngT79. Client/API source hash: 6f3622dc1c66b55a47089be2a01563b3bef581036f6d91fe5dfd99a951119cf9; testing Firebase: chaos-test-d1601; zero GitHub Actions runs for that commit.
- Local compatibility run baseline-targeted-local-20261014-202718: 22 passed, 8 failed, zero skipped; QA cleanup passed. Two causes affected the shared Playwright and release-gate scenarios: the fixture used an undeclared Schedule Builder route, and the emulator API returned HTTP 500 for a live-project token before Admin rejection. Failure media and reports are retained; this is not baseline acceptance.
- Repairs: navigate through the existing Schedule screen and explicit Schedule Builder control; reject live-project tokens in the actual emulator request selector with HTTP 403 before Admin initialization. Added an isolated child-process regression for that selector; both browser inventories retain the functional rejection case.
- Corrected candidate preflight, deployment, targeted and delta results: pending. Phase 1 remains unstarted until they pass.

### Baseline discovery repair — 19.0.2

- Exact prior candidate: 19.0.1 / 2769daf5d069082d07c0e6e31368b6a6ecd8968f / source hash 21b8bc99416c408ccb8d0d6931308750f51c693d39e03b18e7c3ef848e027f7b. Testing deployment dpl_J63q1tB4yKa4QxRdaa2pBXJFxTiF served matching client/API identity and chaos-test-d1601; actual deployed Admin boundary verified before QA writes.
- Prior targeted runs baseline-targeted-local-20261014-204054 and baseline-targeted-deployed-20261014-205803 each passed 30 tests, zero failures/skips, with QA cleanup passing. Canonical failed+new run 2026-10-14T21-18-08 passed all 79 selected tests, zero failures/timeouts/skips; server-verified QA cleanup passed. Canonical current-release prerequisites also passed on that exact sealed source. These results do not constitute full certification or acceptance of the incomplete inventory.
- Diagnosis: promotion tests declared inside a shared helper appeared under fixtures/testing-promotion-scenarios.cjs in Playwright discovery. The inventory parser silently omitted those 12 cases even though direct targeted execution passed them. Baseline acceptance was withheld.
- Repair: declarations now live in each spec; shared helpers contain only scenario bodies. The parser rejects unrecognized test declarations and mismatched Playwright totals. Both Playwright and release-gate specs exercise fail-closed discovery. Real CLI discovery regression requires every promotion case in both specs and both browser projects (16 including the new discovery case).
- Local discovery preflight: 11 passed, zero failed/skipped; real full inventory list verified without executing the full release gate. Host evidence baseline-discovery-20261014-222232.log. Candidate deployment and targeted/delta acceptance remain pending; no Phase 1 implementation has started.

| Phase | Candidate | Status |
|---|---|---|
| 1 — Schedule Builder | 19.0.3 planned | In progress; 19.0.2 baseline accepted |
| 2 — Smart Schedule | Next sequential patch | Not started |
| 3 — Restaurant intelligence | Next sequential patch | Not started |
| 4 — Employee experience | Next sequential patch | Not started |
| 5 — Publishing/reliability/parity | Next sequential patch | Not started |

Runtime evidence is retained outside sealed source. Entries identify actual tested commits and run IDs when available; pending work is not a pass.

### Baseline acceptance — 19.0.2

Accepted 2026-10-14 after exact commit 31e5a67d38c676b3425b79be0dda64023199f6a2 / source hash c1e61d8f301e1a5fa0cbab14d4803a8c76c3a0e161b1c90c10be4221236fdbd5 passed sealed checks (44/44, zero skips), canonical current-release prerequisites, local targeted baseline-targeted-local-20261014-224045 (34/34), deployed targeted baseline-targeted-deployed-20261014-223630 (34/34), and canonical delta 2026-10-14T22-52-33 (16/16, all promotion identities selected). Both targeted runs and delta passed server-verified QA cleanup without leftovers. Actual inventory: 759 declarations, including 16 unique promotion identities. Vercel dpl_9JbhJYJVkahroWZdKYDpF2TWR6GJ is READY; testing.86chaos.com client/API identities match and actual server Firebase boundary is chaos-test-d1601. Zero GitHub Actions runs for the commit. External acceptance proof: baseline-19.0.2-acceptance.json. Physical-device acceptance remains pending; no APK or full release gate was executed.

### Phase 1 implementation candidate — 19.0.3 planned

Weekly desktop and mobile calendars, direct shift editing, move/copy previews, multiple selection, keyboard alternatives, role/station/employee/publication filters, draft recovery and transactional Undo/Redo are implemented in the working tree. Existing monthly tools, Schedule Copilot, publishing, request-off and all application modules are retained. The shared editing service checks canonical identities, current revisions, overlaps, approved leave, availability evidence, verified station competencies, overnight times and DST. Published edits create immutable compensating events. Reviewed month clearing freezes IDs, uses resumable bounded chunks and retains authorized restoration receipts; newer edits and later-created shifts are protected. Assignment retries cannot overwrite later publication.

Development preflight phase1-component-20261015-005515 passed 54 Node checks, 11 component checks and one extensive real Firestore scenario with emulator cleanup. Source changed afterward: current-candidate preflight, deployed targeted and delta acceptance remain pending. Both browser and release-gate wrappers now declare five functional workflows across Chromium, Android Chromium, Edge, Firefox, WebKit and iPhone WebKit (60 discovery identities); execution remains pending. No full gate has run.

Geoff changed the delivery order: build the signed APK from testing before candidate targeted/delta tests, and provide its GitHub release-page link immediately after package verification/upload, with pending acceptance disclosed. The retained signing key matches certificate SHA-256 3b8bbff2d6aa23946e6a0f54dfe1c37e54c58a78c086c96f502c7cf80c3ad633. Existing Android SDK and Gradle cache are available under the separate Documents/86chaos checkout cache; application source development remains exclusively in Documents/GitHub/86chaos on testing.

Native backend dependency: non-mutating GET probes on both authorized production destinations returned 404 for /api/schedule-workspace. APK Firebase and native API destinations remain production; the testing website/API remains chaos-test-d1601. A compiled APK is not evidence of a working production-backed scheduling API. No production deployment is authorized or performed. Physical Android and Apple acceptance remain pending. Geoff now permits Phase 2 only after Phase 1 acceptance passes; stop before Phase 3. Separate production-backed native API deployment authorization is pending.

Phase 1 local preflight phase1-component-20261015-011205: 56 Node checks, 12 React component checks and the extensive real Firestore scenario passed with emulator shutdown. Discovery verified all 60 Phase 1 browser identities without running the full gate. Candidate advanced to 19.0.3; source is sealed for APK packaging before candidate targeted/delta execution. Deployment and browser acceptance remain pending.

### Phase 1 browser repair — next candidate 19.0.4

19.0.3 commit c8749681d8a9cddb9f62c99ffb08929ed331b2ae, source hash 062e337c04ac4eec0807a9fe96869f603cbd815582b39b0131e1adff18fb77bc was pushed to testing and deployed as dpl_Ei1tUhv8t8hj2UkSJ5ER1ikWTdKz. Client/API identity and the actual chaos-test-d1601 server boundary passed. Signed production-Firebase APK packaging, Android unit/lint and retained certificate checks passed; GitHub prerelease testing-v19.0.3-apk was uploaded and download hash verified. These do not establish functional native acceptance.

Deployed targeted run phase1-targeted-deployed-20261015-013611 finished with 4 passes, 3 timeouts and 113 unrun cases after the diagnostic three-failure stop. Authoritative QA cleanup passed with no remaining records. Local targeted, canonical prerequisites and delta did not run. Exact reports and failure media are retained; Phase 1 is not accepted.

Root cause: App's legacy accessibility metadata replaced authored labels with names such as "Schedule field Break minutes" and "Open Monthly & advanced tools". Select labels also incorrectly included every option's text. The repair preserves authored names within the new weekly workspace while retaining legacy metadata/classification elsewhere. A component regression checks exact accessible names and actual saved paid-break values; both browser inventories exercise exact labels and authoritative persistence. The legacy monthly assignment workflow now explicitly enters Schedule Builder before opening monthly tools. No timeout or business assertion is weakened. Corrected candidate preflight, deployment and targeted/delta acceptance remain pending; no full gate has run.

Repair preflight phase1-component-20261015-020543 passed 56 Node checks, 13 component checks and the extensive real Firestore scenario (zero failures/skips), followed by emulator shutdown. Candidate 19.0.4 is being sealed for signed APK packaging; targeted/delta and native backend acceptance remain pending.

### Phase 1 fixture lifecycle repair — next candidate 19.0.5

19.0.4 commit 7279db043bc9dddf5198cde1dddf5ef9f88983ae / source hash 0b37aa75de4dbf3127f17d67b2237c8f236a4e4a6ce08ac9fc795c61b8c353ad deployed as dpl_9Kg92V9h8SXzNosJYg7eMeuFqdEh with matching testing client/API identity and chaos-test-d1601 server boundary. Its signed APK passed Android packaging/unit/lint and retained signing/Firebase checks; GitHub prerelease testing-v19.0.4-apk download hash was verified.

Deployed targeted run phase1-targeted-deployed-20261015-022100 finished with 5 passes, 3 timeouts and 112 unrun cases. Server-verified QA cleanup passed with no remaining records. Local targeted and delta did not run. Failure traces show that create, direct edit, paid-break persistence, Undo and Redo succeeded before reload. A delayed Employee Quick Start tour then intercepted the next shift click. In-body finally cleanup inherited the expired test deadline and obscured that failure; the remaining owned shift caused the following two tests' valid overlap rejection.

Repair: both browser inventories install a handler for the explicit tour-skip action, including delayed tours after reload. Scheduling confirmations remain controlled by the test. Per-workflow cleanup now runs in Playwright afterEach, independently of an expired body deadline, checks only owned IDs, restores online/routing state and attaches authoritative cleanup evidence. Node regressions verify the actual helper's owned-only deletion and refusal to claim cleanup after a denied authoritative read. Business assertions and timeouts are unchanged. New candidate preflight and exact targeted/delta acceptance remain pending. No full gate has run; native backend acceptance is still unresolved.

Repair preflight phase1-component-20261015-024151 passed 58 Node checks, 13 component tests and the extensive real Firestore scenario, with zero failures/skips and emulator shutdown. The preceding development check exposed an incomplete crypto stub in the new cleanup unit fixture; it was corrected, with its failed log retained. Candidate 19.0.5 is sealed next; signed packaging and current-candidate targeted/delta acceptance remain pending.

### Phase 1 interaction repair — next candidate 19.0.6

19.0.5 commit bbcbc93c26105520fc86fbac0873dc973a32abd1 / source hash 206d63b0476e46374196c65e4bb302aa3849ad1f42706fb7d71dd228b80f9bb2 deployed as dpl_EFcuRiqNzuTP5xrEFyCnksNREYLx with verified client/API identity and chaos-test-d1601 boundary. Its signed production-Firebase APK, retained certificate and downloaded GitHub asset hash passed verification (testing-v19.0.5-apk). Deployed targeted run phase1-targeted-deployed-20261015-025452 completed with 11 passes, 3 failures and 106 unrun cases; authoritative QA cleanup passed with no leftovers. Local targeted and delta did not start. The complete editor/persistence/no-op/delete/Undo/Redo workflow now passed.

Remaining failures: drag did not open its preview; the pending-save retry control was behind the editor backdrop; legacy header offset was not recalculated when monthly tools mounted. Inspection also found generic desktop table rules overriding weekly header z-order and making role/employee row headers stick vertically over shifts. Scoped weekly CSS now preserves header layering and horizontal-only employee labels. Both legacy offset measurement and touch-handoff effects rerun when the legacy view mounts. Retry controls are rendered inside the active scheduling dialog, and explicit retry preserves a newer cancelled unsaved draft. Both browser inventories check real pointer hit targets, date-header readability, dialog-scoped exact-request retry and preservation of newer unsaved notes; component coverage checks dialog reachability and draft preservation. No timeout or mandatory assertion was weakened. Corrected-candidate preflight, deployment and targeted/delta acceptance remain pending; no full gate or native acceptance is claimed.

Interaction repair preflight phase1-component-20261015-031744 passed 58 Node checks, 14 component tests and the extensive real Firestore scenario, with zero failures/skips and emulator shutdown. Candidate 19.0.6 is sealed next for signed production-Firebase APK packaging before exact targeted/delta validation. Native backend and physical-device acceptance remain pending.

### Phase 1 native gesture and mobile target repair — next candidate 19.0.7

19.0.6 commit 4debf1c6563970dc8ae8be42dd0640b2f5e089a4 / source hash 0ad73ae6082550df31cffd6f41a9c667132ab1094e99f1a825e68047fb095492 deployed as dpl_DDqCzSL6mFV2ywRn8o33PABqptBB with matching client/API identity and verified chaos-test-d1601 boundary. Signed APK and uploaded GitHub asset checks passed (testing-v19.0.6-apk). Deployed targeted run phase1-targeted-deployed-20261015-033122 completed with 45 passes and 3 failures. Of 72 reported skips, one was the intentional mobile-only touch test on desktop Chromium and 71 were unrun after the diagnostic failure limit. QA cleanup passed with no leftovers. Local targeted and delta did not run.

Editor/persistence/no-op/delete/Undo/Redo, explicit retry with newer-draft preservation, weekly and legacy sticky checks, and mobile reassignment passed. Two desktop drag scenarios failed before preview; a mobile toolbar measured 42px instead of 44px. Local diagnostic phase1-drag-diagnostic-local-20261015-040500 reproduced the original dragTo failure and then captured trusted native dragstart/drop events and a correct preview when movement began before destination scrolling. Its original scenario exit remained failed; the diagnostic experiment is not candidate acceptance. Both diagnostic QA workspaces were authoritatively cleaned.

Repair: both browser inventories now initiate a real mouse drag before scrolling to the target, require trusted native events/custom shift data, then verify preview, authoritative reassignment/copy and recovery. No synthetic drop substitutes for dragging. Scoped styling prevents legacy 42px compact metadata from shrinking weekly/editor controls, preserves readable 14px control text, and verifies all visible mobile buttons and editor fields against the 44px contract. Current-candidate deployment and targeted/delta acceptance remain pending. No full gate or native backend/device acceptance is claimed.

Preflight phase1-component-20261015-041245 passed 58 Node checks, 14 component tests and the extensive real Firestore scenario, with zero failures/skips and emulator shutdown. Candidate 19.0.7 is sealed next for signed packaging before exact targeted/delta execution.

### Phase 1 mobile form and touch-fixture repair — next candidate 19.0.8

19.0.7 commit 3ae9c34856a3ac493d611350223049f05f504196 / source hash 58920260de3f0c330747dda5a46bc8630385451b8c38069597f31a1c09e6c207 deployed as dpl_7HaGqKrxL4jCtLgWANkrzUy3Htjf with matching client/API identity and chaos-test-d1601. Signed production-Firebase APK, retained signer, Android unit/lint and downloaded prerelease asset hash passed verification. Deployed targeted phase1-targeted-deployed-20261015-042719 finished with 64 passes, 3 failures, one intentional desktop skip and 52 unrun cases. Authoritative QA cleanup passed with no leftovers. Local targeted and delta did not start. Trusted native desktop drag/drop, preview, reassignment/copy/recovery now passed in both browser inventories; mobile editing/recovery/reassignment also passed.

Two failures identified 43px editor dropdowns. The global compact form selector's :is() input arm carries five attribute exclusions, giving every arm greater specificity than the previous scheduler guard. Scoped weekly/editor selectors now match those exclusions with the additional scheduler scope, retaining the 44px minimum for selects as well as inputs/buttons. Both functional browser inventories still assert actual geometry and now name the failing control.

The third failure's touch fixture dispatched against the header's coordinates before it was visible in the nested scrollport. Isolated local diagnostic phase1-mobile-diagnostic-local-20261015-045939 reproduced the 43px selects and offscreen target, then pinned the header and verified the same touch handler advanced scrollTop from 1550 to 1670 without moving the header. Diagnostic cleanup passed. A shared touch scenario now finds the real vertical scroll host, pins the header with room for the gesture, proves document.elementFromPoint hits the header before dispatch, and verifies actual scrolling plus stable header position. Both Phase 1 browser inventories and the existing release-gate touch case exercise it. These synthetic touch events verify the application's explicit handoff handler; they are not physical-device evidence. No mandatory assertion, timeout or inventory was weakened.

Repair preflight phase1-component-20261015-050246 passed 58 Node checks, 14 component tests and the extensive real Firestore transaction scenario, zero failures/skips, followed by emulator shutdown. Candidate 19.0.8 is being sealed for signed APK packaging before exact targeted/delta validation. Native production API compatibility and physical-device/iOS acceptance remain pending. Phase 1 is not accepted; no full gate or Phase 2 has started.
