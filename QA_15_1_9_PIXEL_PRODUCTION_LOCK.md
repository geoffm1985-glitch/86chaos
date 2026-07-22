# QA Checklist: 15.1.9 Pixel + Production Lock

## Static validation performed
- [x] Version bumped to 15.1.9 in package, public version file, and runtime constant.
- [x] System Admin navigation rail swap exists.
- [x] Top command selector switches to System Administrator mode on admin route.
- [x] 188px sidebar and 64px header mockup sizing overrides exist.
- [x] Recipe thumbnail and hero crop assets exist in public/.
- [x] Panel action rendering avoids invalid nested interactive elements.
- [x] Today dashboard action buttons route to existing app tabs where practical.

## Browser QA to run locally or in Vercel preview
- [ ] Open login screen at desktop width and compare to uploaded login mockup.
- [ ] Open Today dashboard at 1672x941, 1920x1080, 1440x900, and 1366x768.
- [ ] Open Schedule and verify the grid, right inspector, KPI strip, and bottom panels remain readable.
- [ ] Open Prep & Tasks and verify prep board, 86 alerts, voice panel, and manager overview do not overlap.
- [ ] Open Inventory and verify table, right scan panels, and ordering recommendations fit.
- [ ] Open Recipes and verify cropped food images load.
- [ ] Open Financials and verify ledger/timesheet tables scroll only when necessary.
- [ ] Open Settings and verify category rail and setting rows match the mockup proportions.
- [ ] Open System Administrator with a super-admin account and verify the admin-only nav rail appears.
- [ ] Open as a non-super-admin and verify System Administrator remains blocked.
- [ ] Test mobile at 390px and 430px for no horizontal layout blowouts except true tables.
- [ ] Test sign in, workspace selection, and magic/MFA links.
- [ ] Test Firestore read/write flows that existed before this redesign.
- [ ] Test invoice scan, menu scan, burn log, voice command, reminders, push notifications, exports, and settings save.

## Build/test commands
```bash
npm install
npm test
npm run build
```

## Honest confidence note
Static project validation passed when this checklist is complete. Production confidence becomes high only after the browser/Firebase checklist above is completed in the real environment.
