# QA Checklist - 15.1.13 Live Graph + Mobile Layout Lock

## Completed in package validation
- Confirmed unauthorized System Admin route now shows a generic permission gate without internal admin navigation labels.
- Confirmed customer Help Center filtering hides backend credential/setup help text from non-platform users.
- Confirmed app version is 15.1.13 in package.json, public/version.json, and CURRENT_VERSION.
- Confirmed Firebase Admin / dispatch-reminders credential files were not modified in this pass.
- Confirmed the old Firebase Admin setup error string is not present in dispatch credential files.
- Confirmed live graph helpers exist in the reference UI layer.
- Confirmed static SVG chart shapes were replaced with live series rendering / live empty states.
- Confirmed mobile CSS lock exists for one-column panels and contained table scrolling.
- Confirmed mobile Time Clock and Schedule quick actions exist.

## Manual browser QA still required
- Run npm install, npm test, npm run build.
- Open mobile widths 390px and 430px: Today, Schedule, Inventory, Prep, Recipes, Financials, Settings.
- Verify no page-level sideways overflow on mobile.
- Verify the fixed Time Clock and Schedule quick buttons are visible and open the schedule/time clock screen.
- Verify Schedule tables scroll only inside their panel.
- Verify graphs show real data where the workspace has records and live-empty states where it does not.
- Verify invoice scan, menu scan, burn log, exports, schedule publishing, and time clock actions still use the existing flows.
