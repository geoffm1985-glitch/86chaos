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
| 1 — Schedule Builder | Next sequential patch | Not started; baseline must pass |
| 2 — Smart Schedule | Next sequential patch | Not started |
| 3 — Restaurant intelligence | Next sequential patch | Not started |
| 4 — Employee experience | Next sequential patch | Not started |
| 5 — Publishing/reliability/parity | Next sequential patch | Not started |

Runtime evidence is retained outside sealed source. Entries identify actual tested commits and run IDs when available; pending work is not a pass.
