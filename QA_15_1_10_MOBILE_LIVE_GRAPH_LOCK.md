# QA Checklist: 15.1.10 Mobile Live Graph Lock

## Static verification completed
- [x] Version bumped to 15.1.10 in `package.json`.
- [x] Version bumped to 15.1.10 in `public/version.json`.
- [x] Runtime `CURRENT_VERSION` bumped to 15.1.10.
- [x] `useLiveCollection` supports global internal-admin reads through an explicit `global: true` option.
- [x] System Administrator reference dashboard requests global collections only through the explicit `global: true` option.
- [x] Today dashboard uses live sales, labor, inventory, prep, tasks, recipes, dependencies, alerts, users, and shifts.
- [x] Inventory dashboard uses live inventory, vendors, invoices/scans, burn/waste logs, and menu-scan intelligence collections.
- [x] Financials dashboard uses live sales, time punches, and expenses.
- [x] Recipes dashboard uses live recipes, inventory, and menu dependencies.
- [x] Static chart shapes were replaced with live-generated line/bar/spark/donut/progress components.
- [x] Mobile CSS includes a final 15.1.10 override after the tablet/desktop pixel-lock rules.
- [x] Mobile app content is constrained to 100vw with page-level horizontal overflow hidden/clipped.
- [x] True wide grids remain scrollable inside their own panels.
- [x] Current release notes only.

## Manual browser QA to run locally/preview
- [ ] Open at 390px width and verify the System Administrator dashboard stacks vertically with no clipped right-side cards.
- [ ] Open at 430px width and verify Today, Prep, Inventory, Recipes, Financials, Settings, and System Admin do not create page-level horizontal overflow.
- [ ] Verify bottom mobile nav does not cover final panel actions after scrolling to the bottom.
- [ ] Verify true schedule grids scroll inside the schedule panel only.
- [ ] Verify inventory/ledger/timesheet tables scroll inside their panels only.
- [ ] Login as owner/manager/staff and verify role gates still behave correctly.
- [ ] Login as configured system admin and verify System Administrator loads without exposing raw secrets.
- [ ] Confirm KPI charts change when live sales/time-punch/inventory data changes.
- [ ] Confirm empty live states appear when a collection has no records.
- [ ] Run full Playwright suite against the preview or production URL.
- [ ] Run `npm run build` after dependencies are installed.
