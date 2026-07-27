# 86 Chaos App Store / Play Store Release Gate

This is a production-grade release gate for the current 86 Chaos v16.0.32 app. It does not change the visual design or application behavior. The Playwright, Firebase emulator, accessibility, and property-testing packages are installed into the isolated `release-gate-tools` folder so they are not bundled into the deployed application.

## Disposable test restaurant

The gate creates this exact testing-only restaurant:

`86 Chaos Full Audit QA Restaurant`

Every seeded record is marked with:

- `qaOwned: true`
- `qaRunId: <unique run ID>`
- `createdBy: "86chaos-full-audit"`

That exact name and marker match the existing cleanup workflow in:

`System Administrator > Platform Operations > Full Audit QA Cleanup`

The gate normally removes the test restaurant during global teardown. When cleanup is interrupted, or the run uses `-KeepTestRestaurant`, it remains available for review and can be removed from Platform Operations using the existing hard-delete confirmation:

`DELETE QA AUDIT RESTAURANTS`

## Production safety

The preflight refuses mutation testing against:

- `app.86chaos.com`
- `86chaos.com`
- Firebase project `cheers-34b8d`
- a Firebase project that does not equal `CHAOS_EXPECTED_TEST_FIREBASE_PROJECT_ID`
- placeholder credentials
- missing owner, manager, staff, or System Administrator test accounts

Use the testing Firebase project, normally `chaos-test-d1601`, and the latest testing Vercel preview.

## Setup

1. Copy `.env.test.local.example` to `.env.test.local`.
2. Enter the latest testing-preview URL.
3. Enter four dedicated testing accounts: owner, manager, staff, and System Administrator.
4. Add testing-only email and push recipients.
5. Keep `.env.test.local` out of source control.
6. Use Node 24.x.

## One-line command

From the app root in PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1
```

The same gate can be started with:

```powershell
npm run test:play-store
```

Leave the QA restaurant behind for manual inspection:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1 -KeepTestRestaurant
```

Run a non-mutating diagnostic pass:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1 -NoMutation
```

## What the gate runs

- Node 24 and production-safety preflight
- clean production dependency install without test-only deployment packages
- isolated release-tool installation
- Chromium, Firefox, and WebKit installation
- source inventory and reachability analysis
- current v16.0.32 source validator
- API and Python syntax checks
- ESLint
- client Jest tests with enforced coverage
- server/API behavior tests
- production build
- Firestore and Storage emulator authorization tests
- automatic QA restaurant creation and role-membership setup
- owner, manager, staff, and System Administrator journeys
- desktop, tablet, and mobile layouts
- horizontal-overflow and tap-target checks
- accessibility scans
- interactive-control census
- schedule, time clock, time off, availability, trades, events, labor, sales, inventory, invoices, recipes, prep, tasks, maintenance, messages, alerts, and reminders
- System Administrator and Platform Operations protections
- stale-chunk, offline, crash-pipeline, API-contract, input-fuzz, PWA, and installability checks
- Firebase listener/write and no-op-write evidence
- automatic QA cleanup

## Reports

Results are written under:

`test-results/86chaos-play-store-release-gate`

The runner also creates:

`test-results/86chaos-play-store-release-gate-UPLOAD-ME-<run-id>.zip`

That ZIP contains the console logs, reports, screenshots, traces, videos retained on failure, and Playwright HTML report.

A red result is a release blocker or missing proof. Do not weaken thresholds merely to make the dashboard green.
