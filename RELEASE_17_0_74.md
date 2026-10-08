# 86 Chaos 17.0.74 - Partial-Resume Firebase Target Fixture Repair

## Scope

Surgical repair for the 17.0.73 full-gate server blocker. The historical 16.0.231 partial-resume regression created synthetic environment evidence with a hard-coded live testing project even when Yardmaster explicitly selected the local Firebase emulator target.

## Repair

- Both synthetic preflight constructions now derive `firebaseProjectId` from the shared `expectedFirebaseProject(process.env)` resolver.
- Historical LIVE behavior remains `chaos-test-d1601`.
- EMULATOR behavior now correctly resolves `demo-86chaos`.
- The existing project-drift test still proves a genuinely different Firebase project refuses partial resume.
- No production Firebase routing, application runtime, security rule, or deployment behavior changes.

## Regression coverage

- Node: `api/partial-run-evidence-emulator-target-17-0-74.test.cjs`
- Play Store/release-gate Playwright: `tests/86chaos-release-gate/86-partial-run-evidence-emulator-target-17-0-74.spec.cjs`
- Independent Playwright: `tests/e2e/partial-run-evidence-emulator-target-17-0-74.spec.cjs`