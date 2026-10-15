# Standing user instructions

## Local testing and GitHub Actions

- Always run tests and release gates locally on Geoff's computer.
- Always run Playwright and Play Store tests in a visible PowerShell window. Never run these tests in a hidden window or background scheduled task.
- Never use GitHub Actions unless Geoff explicitly authorizes GitHub Actions, including dispatches, reruns, and indirect triggers from pushes.
- Inspect workflow triggers before pushing. A general request to test, build an APK, publish a release, or push code does not authorize GitHub Actions.
- If local tooling is missing or execution is blocked, work toward a local solution instead of substituting GitHub Actions.

## APK Firebase target

- Give Geoff the GitHub release page for APK downloads; direct APK asset URLs do not work for him. Explain Assets when helpful.
- Every APK built or published for Geoff must use production Firebase project `cheers-34b8d`, production native Firebase registrations, and production API destinations.
- Testing website work never authorizes switching an APK to testing Firebase. Never publish a testing-Firebase APK.
- Verify the actual packaged Firebase resources, origin, API destinations, release version and retained signing certificate before publishing.

## Universal platform parity and scheduling rebuild

- Every existing and future capability must preserve equivalent business functionality across Android APK, Android/iPhone browsers, Windows Chrome/Edge, supported desktop PWAs and native iOS when the Apple toolchain is available. Assess parity for every change; provide feasible hardware fallbacks and honest device evidence.
- Every feature change requires functional Playwright and canonical Play Store/release-gate regression coverage. Do not remove features or weaken assertions to pass tests.
- Develop this program exclusively on testing from the complete promoted mobile source. Never modify mobile, main or experimental or deploy production. Geoff explicitly selected 19.0.0 as this program's first candidate; increment subsequent candidates sequentially and synchronize applicable identities.
- Testing website and API destinations must use chaos-test-d1601. Native APKs must retain cheers-34b8d, production API destinations and retained signing identity. No testing-Firebase APKs, production APK publication or production deployment.
- Each baseline/phase must implement, preflight locally, version/seal/commit, push testing, verify deployed identity, then pass targeted and delta validation before advancing. No full release gate until all five phases and final targeted/delta validation pass; never run a full gate to bootstrap phase lineage.
- Geoff authorizes automatic Phase 1 advancement after the baseline passes. Finish Phase 1 and all required repairs/validation, then stop before Phase 2 until he explicitly authorizes it. Do not provide an APK link until Phase 1 is complete and its targeted/delta validation passes.
- Preserve role/tenant boundaries, owner-only wage access, MFA/App Check, auditing, backups, immutable publication records and POS read-only restrictions. Require previews for consequential AI actions, idempotency, concurrency checks and authoritative save evidence.
- Keep docs/SCHEDULING_WORLD_CLASS_IMPLEMENTATION.md, docs/SCHEDULING_PHASE_TEST_MATRIX.md, docs/UNIVERSAL_PLATFORM_PARITY_MATRIX.md and docs/ENGINEERING_PLAYBOOK.md current with actual evidence and pending limitations.

## Test-result retention

- Check live processes and run status/locks before and after test sessions. Never delete or modify another active flow's results, baseline or lineage evidence.
- Once idle retain the latest full and scoped reports, latest unresolved failure media, and newest three completed folders unless current lineage needs more. Target at most 2 GiB; report protected evidence exceeding that budget.
- Restrict cleanup to resolved test-output paths inside the intended checkout. Reject reparse points; use native PowerShell without forced removal. Record removals/reclaimed space in host cache outside source. Never delete source, APKs, signing material or active service data.
- Close task-owned PowerShell windows on completion after checking console-attached processes; preserve active tests/services. Housekeeping does not authorize starting or restarting flows.
