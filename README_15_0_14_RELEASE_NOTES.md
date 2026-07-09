# 86 Chaos 15.0.14 Release Notes

## Summary

15.0.14 adds the next reliability layer: a dedicated AI Tools page, better support reporting with device diagnostics, offline queue visibility, full Vercel API route health manifest checks, and safer Menu Intelligence ingredient approval controls.

## Included changes

1. **Dedicated AI Tools screen**
   - Added an AI Tools tab for admins/managers with shortcuts to Menu Intelligence, Invoice Scanner, voice commands, and Smart Prep Matching.
   - The page reminds managers that AI suggestions must still be reviewed before changing stock or menu impact data.

2. **Problem reporting upgrade**
   - Added a header Report Problem button.
   - Reportable error/failed/blocked toasts now include a Report Problem action.
   - Reports are saved to `crashReports` with active page context and device diagnostics.

3. **Device diagnostics**
   - Captures version, Firebase project, host, network state, service worker support, notification permission, camera/mic support, local storage status, screen size, and offline queue count.

4. **Offline queue visibility**
   - The app shell shows when offline writes are queued.
   - The Report Problem modal can attempt to replay queued offline writes.

5. **Full Vercel API route health manifest**
   - Added `/api/health-checks`.
   - System Administrator → Health Dashboard now checks the route and displays every known `/api/*` route with ready/attention state.
   - This avoids destructive route calls while still confirming route files exist and handlers load.

6. **Menu Intelligence ingredient approval**
   - Added confidence badges for ingredient rows.
   - Added Approve/Skip controls per ingredient.
   - Approval skips rejected rows and saves only reviewed/approved matched ingredients into `menuDependencies`.

## Not included

- Full MFA enrollment and elevated-role enforcement.
- Full automated Firebase rules tests.
- Full end-to-end test suite.
- Full setup wizard.
- Owner dashboard.
- Professional demo mode.
- Full mobile-first cleanup across every screen.
