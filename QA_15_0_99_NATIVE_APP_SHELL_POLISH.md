# QA Checklist: 15.0.99 Native App Shell Polish

## Automated validation

- [x] `npm test -- --watch=false`
- [x] `node --check src/App.js`
- [x] `node --check scripts/validate-15-0-99.js`

## Manual smoke checks

- [ ] Desktop: header still shows restaurant/workspace identity and menu opens as overlay.
- [ ] Desktop: left shortcut rail opens Today, Schedule, Prep, Inventory/86, and More without covering page content.
- [ ] Desktop: Financials, Back Office, Schedule, Inventory, Settings, Help, and System Administrator gate still render correctly based on permissions.
- [ ] Mobile: bottom navigation appears above the safe area and does not cover important action buttons.
- [ ] Mobile: Today, Schedule, Prep, 86, and More shortcuts work.
- [ ] Mobile: drawer menu still overlays the app and does not push the page down.
- [ ] Mobile: time clock and schedule workflows remain usable with thumb/touch navigation.
- [ ] Route loading: temporary route skeleton appears instead of a plain webpage-style loading block.
- [ ] Version check: deployed preview shows `Version 15.0.99`.
- [ ] Push notifications: 15.0.98 duplicate-notification behavior remains fixed.

## Recommended Playwright follow-up after deploy

Update `.env`:

```env
CHAOS_EXPECTED_VERSION=15.0.99
```

Run targeted checks first:

```powershell
cd C:\Users\geoff\Documents\GitHub\86chaos
npx.cmd playwright test tests/86chaos-deep-suite/01-auth-permission-matrix.spec.js --project=chromium --headed --workers=1
npx.cmd playwright test tests/86chaos-deep-suite/06-mobile-layout.spec.js --project=chromium --headed --workers=1
npx.cmd playwright test tests/86chaos-deep-suite/09-backup-restore-admin-safety.spec.js --project=chromium --headed --workers=1
```
