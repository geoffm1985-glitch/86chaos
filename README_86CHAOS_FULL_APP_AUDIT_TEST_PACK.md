# 86 Chaos Full App Audit Test Pack

This pack is built to be the big ugly flashlight for 86 Chaos: routes, permissions, layout, math, schedule builder, events, request-off, inventory, recipes, financials, maintenance, reminders, presence, known regressions, fake QA data, and one uploadable report.

It is intentionally not a “make the tests pass” pack. If the app is wrong, the report should say the app is wrong.

## Single command

From the 86 Chaos repo root after extracting this ZIP:

```powershell
.\RUN_86CHAOS_FULL_APP_AUDIT.cmd
```

That runs the safe/full read-only audit and creates one upload file in `test-results`.

## Full fake restaurant mutation mode

For the full fake-restaurant audit, run this single command against a test/preview URL only:

```powershell
.\RUN_86CHAOS_FULL_APP_AUDIT.cmd -Mutation
```

Mutation mode requires one of these safety choices:

```powershell
$env:CHAOS_QA_RESTAURANT_ID="your_disposable_test_restaurant_id"
```

or:

```powershell
$env:CHAOS_QA_CREATE_RESTAURANT="true"
```

or, only for a disposable workspace:

```powershell
$env:CHAOS_QA_SEED_CURRENT_RESTAURANT="true"
```

The runner refuses mutation on obvious production URLs like `app.86chaos.com` unless you deliberately alter the scripts.

## Required environment

At minimum:

```powershell
$env:APP_URL="https://your-preview-url.vercel.app"
$env:CHAOS_EXPECTED_VERSION="16.0.19"
$env:OWNER_EMAIL="..."
$env:OWNER_PASSWORD="..."
```

Recommended:

```powershell
$env:MANAGER_EMAIL="..."
$env:MANAGER_PASSWORD="..."
$env:STAFF_EMAIL="..."
$env:STAFF_PASSWORD="..."
$env:SYSTEM_ADMIN_EMAIL="..."
$env:SYSTEM_ADMIN_PASSWORD="..."
```

## What it includes

- Build/deploy/package guard
- Package-lock fake dependency guard
- Firebase config safety-marker guard
- Route health for all main pages/tabs
- Permission/security gate checks
- Safe button crawl
- Schedule Builder mutation/data-integrity checks
- Independent schedule math oracle
- Allen-style week math regression tests
- Invalid time range tests such as `10p-3p`
- Pay-period boundary math fixture
- Request-off/availability checks
- Scheduled event checks in Schedule Builder
- Time Clock/timesheet route checks
- Financials/labor math checks
- Inventory/vendor/par/86 alert checks
- Recipes/menu dependency checks
- Prep/tasks/checklist checks
- Maintenance/PM checks
- Messages/86 alerts checks
- Reminders checks
- Online/Last Seen presence truth checks
- System Administrator danger-action checks
- Mobile layout, tap target, keyboard focus checks
- Desktop grid/readability checks
- 86Voice mic button checks
- Upload/scan surface checks
- Cross-module full restaurant day checks
- Read/write cost guard smoke check
- Export/import surface checks
- Permanent regression graveyard

## Output

After the command finishes, upload the newest file named like:

```text
86chaos-full-audit-UPLOAD-ME-YYYY-MM-DDTHH-mm-ss.zip
```

If the ZIP is too large, upload the matching `.txt` file instead.

## Useful modes

Fast audit:

```powershell
.\RUN_86CHAOS_FULL_APP_AUDIT.cmd -Fast
```

Schedule-only audit:

```powershell
.\RUN_86CHAOS_FULL_APP_AUDIT.cmd -ScheduleOnly
```

Headed browser:

```powershell
.\RUN_86CHAOS_FULL_APP_AUDIT.cmd -Headed
```

Skip production build if you already know it builds:

```powershell
.\RUN_86CHAOS_FULL_APP_AUDIT.cmd -NoBuild
```

Keep fake QA seed data after mutation run:

```powershell
.\RUN_86CHAOS_FULL_APP_AUDIT.cmd -Mutation -NoCleanup
```

## Notes

The schedule math tests use an independent oracle, not the app’s helper. That prevents app math and test math from both being wrong in the same way.

The fake restaurant seed records are tagged with:

```text
qaOwned: true
qaRunId: <run id>
createdBy: 86chaos-full-audit
```

Cleanup only targets records with `qaOwned: true` in the selected QA restaurant.
