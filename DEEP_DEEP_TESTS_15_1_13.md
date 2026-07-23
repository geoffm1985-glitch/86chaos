# 86 Chaos 15.1.13 DEEP DEEP Test Suite

This suite is intentionally heavier than the normal smoke checks. It is meant to catch dead wiring, fake/static graph regressions, mobile layout problems, permission leaks, broken admin buttons, and 86Voice dock issues.

## What it tests

- Owner login, version, and app shell health.
- Every major app route: Today, Time Clock/Schedule, Schedule Builder, Financials, Sales, Labor, Back Office, Inventory, Recipes, Prep, Messages, Staff Roster, Settings, Help, Manager Brief, AI/Voice, and Reminders.
- Safe visible buttons and links across high-value routes.
- System Administrator rail sections, quick actions, and Exit Admin.
- Top copper 86Voice button sizing/color and real dock opening.
- Live graph/data contracts: live chart primitives, live-empty states, no hardcoded SVG polyline art, no NaN/undefined math.
- Mobile layout: no page-level sideways overflow, bottom nav priority, quick Time Clock and Schedule access, overlay drawer behavior.
- Search/filter/select/export surfaces.
- Staff permission boundaries and System Administrator access boundaries when the matching credentials are supplied.
- Source-level wiring contracts for admin, mobile, voice, and live graph code.

## Safe vs mutating mode

By default the suite does **not** click dangerous/mutating controls such as Delete, Restore, Emergency Read-Only, Publish, Clock In, Clock Out, Save, Create, Upload, Scan, or Deploy.

To test those in a disposable test workspace only:

```powershell
$env:CHAOS_ALLOW_MUTATION="1"; npx.cmd playwright test --config=playwright.deep.config.js --project=chromium
```

## Single command

From the project folder in PowerShell:

```powershell
npm.cmd install; if ($LASTEXITCODE -eq 0) { npm.cmd install -D @playwright/test }; if ($LASTEXITCODE -eq 0) { npx.cmd playwright install chromium }; if ($LASTEXITCODE -eq 0) { npx.cmd playwright test --config=playwright.deep.config.js }
```

## Reports

After the run:

```powershell
npx.cmd playwright show-report playwright-report-deep-deep
```

## Notes

- The config only runs `tests/chaos-deep-deep`, so it will not accidentally run old duplicate test folders.
- System Administrator wiring is skipped if `SYSTEM_ADMIN_EMAIL` and `SYSTEM_ADMIN_PASSWORD` are not configured.
- Staff permission checks are skipped if `STAFF_EMAIL` and `STAFF_PASSWORD` are not configured.
- Local server auto-starts only when `CHAOS_BASE_URL` points at localhost and `CHAOS_SKIP_WEBSERVER` is not set to `1`.
