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

| Phase | Candidate | Status |
|---|---|---|
| 1 — Schedule Builder | Next sequential patch | Not started; baseline must pass |
| 2 — Smart Schedule | Next sequential patch | Not started |
| 3 — Restaurant intelligence | Next sequential patch | Not started |
| 4 — Employee experience | Next sequential patch | Not started |
| 5 — Publishing/reliability/parity | Next sequential patch | Not started |

Runtime evidence is retained outside sealed source. Entries identify actual tested commits and run IDs when available; pending work is not a pass.
