# QA Checklist: 15.0.101 Premium App UI Polish

## Visual shell checks

- [ ] Desktop shows one navigation system: left sidebar only.
- [ ] Mobile shows one navigation system: bottom nav only.
- [ ] Desktop header looks like a compact app command bar, not a marketing/web header.
- [ ] Current tool label is visible on desktop/tablet header.
- [ ] Workspace chip is visible and still opens workspace switcher when multiple workspaces exist.
- [ ] Drawer menu still opens from the header and side/bottom More button.
- [ ] App version reads 15.0.101.

## Work screen checks

- [ ] Inventory Count loads normally.
- [ ] Inventory rows look flatter/cleaner and remain readable on desktop.
- [ ] Par input still updates par value when permitted.
- [ ] Stock +/- controls still update stock when permitted.
- [ ] Below-par items still stand out without excessive glow.
- [ ] Schedule, Today, Prep, Financials, Back Office, Settings, and Help still load.

## Regression checks

- [ ] Staff permissions still gate restricted routes.
- [ ] Staff does not see System Administrator internals or internal Help Center articles.
- [ ] QuickBooks remains review-first only.
- [ ] Push notifications do not duplicate on the same device/browser.
- [ ] No console TypeError/ReferenceError appears during normal route switching.

## Suggested Playwright checks

```powershell
cd C:\Users\geoff\Documents\GitHub\86chaos
npx.cmd playwright test tests/86chaos-deep-suite/01-auth-permission-matrix.spec.js --project=chromium --headed --workers=1
npx.cmd playwright test tests/86chaos-deep-suite/06-mobile-layout.spec.js --project=chromium --headed --workers=1
npx.cmd playwright test tests/86chaos-deep-suite/10-performance-slow-pages.spec.js --project=chromium --headed --workers=1
```
