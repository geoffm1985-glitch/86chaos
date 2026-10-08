# 86 Chaos 17.0.75 - QA Role Emulator Fixture Target Repair

## Captured failure
The completed 17.0.74 full Yardmaster gate reached local server checks and blocked before Playwright in api/qa-role-definitions.test.cjs. The role analyzer correctly resolved the active expected Firebase project through the canonical target helper, but the test fixture still stamped its synthetic rows with chaos-test-d1601. In explicit emulator mode the expected project is demo-86chaos, so the fixture produced project-mismatch errors before the intended owner/admin assertions could run.

## Surgical repair
- Bump the testing build to 17.0.75.
- Keep the production role analyzer, permissions, System Administrator authority model, and Firebase security behavior unchanged.
- Change only the current-target QA role fixture rows to use EXPECTED_FIREBASE_PROJECT from qa-role-definitions.cjs.
- Pass that same resolved project explicitly into analyzeRoleRows for the fixture assertions.
- Preserve the dedicated live-target regression so chaos-test-d1601 remains verified when LIVE is selected.

## Coverage
- Repaired server fixture: api/qa-role-definitions.test.cjs.
- Targeted Node regression: api/qa-role-fixture-emulator-target-17-0-75.test.cjs, which reruns the exact role fixture under EMULATOR and LIVE target modes.
- Mandatory Play Store/release-gate Playwright regression: tests/86chaos-release-gate/87-qa-role-emulator-target-17-0-75.spec.cjs.
- Independent Playwright regression: tests/e2e/qa-role-emulator-target-17-0-75.spec.cjs.

No production push or deployment is included.
