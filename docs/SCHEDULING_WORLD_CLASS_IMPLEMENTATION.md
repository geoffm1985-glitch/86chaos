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
