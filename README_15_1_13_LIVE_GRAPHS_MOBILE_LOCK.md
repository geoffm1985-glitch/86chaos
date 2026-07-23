# 86 Chaos 15.1.13 Live Graph + Mobile Layout Lock

## What changed
- Added a targeted Playwright permission-gate fix: unauthorized direct visits to System Admin no longer render the internal admin rail, Backup Center labels, forensics labels, or admin-only shell text before the permission gate.
- Tightened Help Center filtering so customer/owner/staff help pages do not surface backend credential/setup terms such as service account, CRON_SECRET, or Firebase service account key.
- Rebased on the clean 15.1.12 Firebase-safe app base.
- Did not change Firebase Admin, cron, service account, dispatch credential loading, Firestore rules, Storage rules, or Vercel environment handling.
- Rewired the reference dashboard layer so graphs, KPI trends, donuts, bars, low-stock panels, recipe margin panels, financial trends, schedule totals, prep totals, and System Administrator health panels derive from live collections or passed live props where available.
- Removed fake static chart values from the mockup layer. When live data is missing or inaccessible, panels now show live-empty states instead of pretending there is data.
- Passed live sales/time punch data into Schedule and Published Schedule routes, live prep/task/inventory data into Prep, and live inventory data into Inventory.
- Locked mobile layouts to one sleek column with page-level overflow clipped and true tables/grids scrolling inside their own panels only.
- Added fixed mobile quick actions for Time Clock and Schedule, and prioritized Clock/Schedule in the mobile bottom nav.

## Important safety note
This release intentionally does not touch Firebase Admin credential logic or cron credential setup.

## 15.1.13 UI Action Hotfix
- Fixed System Administrator rail buttons so Overview, Workspaces, Global Users, Security Center, Backup Center, Push Health, Forensics, Automation, Support, Retention, Access Control, Deployment, and Operations each open a real section view.
- Added System Administrator escape paths: Exit to App in the admin rail and Exit Admin in the top bar.
- Wired System Administrator panel actions and quick actions to section views, audit log, or safe review toasts instead of dead buttons.
- Mounted the real 86Voice dock in the app shell.
- Changed the top microphone button so it opens the 86Voice dock directly instead of only navigating to AI Tools.
- Enlarged the top 86Voice button and matched it to the app copper treatment.
- Firebase/backend/cron files were not changed.
