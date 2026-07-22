# 86 Chaos 15.1.13 Live Graph + Mobile Layout Lock

## What changed
- Rebased on the clean 15.1.12 Firebase-safe app base.
- Did not change Firebase Admin, cron, service account, dispatch credential loading, Firestore rules, Storage rules, or Vercel environment handling.
- Rewired the reference dashboard layer so graphs, KPI trends, donuts, bars, low-stock panels, recipe margin panels, financial trends, schedule totals, prep totals, and System Administrator health panels derive from live collections or passed live props where available.
- Removed fake static chart values from the mockup layer. When live data is missing or inaccessible, panels now show live-empty states instead of pretending there is data.
- Passed live sales/time punch data into Schedule and Published Schedule routes, live prep/task/inventory data into Prep, and live inventory data into Inventory.
- Locked mobile layouts to one sleek column with page-level overflow clipped and true tables/grids scrolling inside their own panels only.
- Added fixed mobile quick actions for Time Clock and Schedule, and prioritized Clock/Schedule in the mobile bottom nav.

## Important safety note
This release intentionally does not touch Firebase Admin credential logic or cron credential setup.
