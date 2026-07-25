# 86 Chaos 16.0.3 Failed-Only Regression Test Pack

This pack runs only the things that failed in the last DEEP DEEP DEEP run.

It does **not** replace the big production suite. It is the quick follow-up pack for the current red failures.

## Includes

```text
tests/86chaos-failed-only/01-failed-route-health-only.spec.js
tests/86chaos-failed-only/02-failed-button-crawl-only.spec.js
tests/86chaos-failed-only/03-failed-mobile-schedule-only.spec.js
tests/86chaos-failed-only/utils/failed-only-helpers.js
scripts/collect-failed-only-errors.js
RUN_86CHAOS_FAILED_ONLY_TESTS.cmd
RUN_86CHAOS_FAILED_ONLY_TESTS.ps1
```

## What it checks

Only the failures from the last run:

- Route health for: Financials, Back Office, Recipes, Messages, Team, Maintenance, Help, System Administrator
- Safe button crawl for: Today, Financials, Back Office
- Mobile Time Clock & Schedule: My Schedule, Full Schedule, Month View, Request Off, Availability, no sideways overflow
- Employee Quick Start modal is dismissed before assertions/clicks so it does not poison the result

## Run

Extract this ZIP into the repo root:

```powershell
cd C:\Users\geoff\Documents\GitHub\86chaos
Expand-Archive "$env:USERPROFILE\Downloads\86chaos_16_0_3_failed_only_regression_test_pack_v4.zip" -DestinationPath . -Force
.\RUN_86CHAOS_FAILED_ONLY_TESTS.cmd
```

Headed mode:

```powershell
.\RUN_86CHAOS_FAILED_ONLY_TESTS.cmd -Headed
```

## Upload file

After it runs, upload the generated file:

```text
test-results/86chaos-failed-only-UPLOAD-ME-<timestamp>.txt
```


## v3 fix
- Moved Pixel 7 `test.use()` to the top level of `03-failed-mobile-schedule-only.spec.js` so Playwright does not throw the defaultBrowserType/new worker error before running tests.


## v4 fix

- Defaults expected version to 16.0.3.
- Recipes route expected text now accepts actual spec/recipe-library wording like New Spec, Upload File, Yield, and categories.
