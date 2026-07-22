# 86 Chaos 15.1.10 Mobile Live Graph Lock

## What changed
- Fixed the reference dashboard mobile layout so dense desktop grids collapse to one-column mobile panels instead of creating clipped side-by-side cards.
- Forced page-level horizontal overflow off for the mockup UI shell while keeping true data grids and schedule grids scrollable inside their own panels.
- Converted dashboard charts from static visual shapes to live-data-generated charts:
  - KPI sparklines are generated from rolling live values.
  - Sales/labor line charts are generated from real sales and time-punch series.
  - Financial sales/labor bar charts are generated from real sales and labor cost series.
  - Donut and progress charts receive computed live percentages.
- Removed fake chart confidence behavior. When live data is missing, the screen now shows an empty/live state instead of pretending there is real graph data.
- Passed live `sales`, `timePunches`, `prepItems`, `tasks`, and `inventoryItems` into the redesigned reference screens so the mockup layer uses the same app data already being loaded.
- Added global collection support to `useLiveCollection` for internal System Administrator dashboards without weakening security rules. Firestore rules still decide what the signed-in account may read.
- Updated runtime/public/package version to 15.1.10.

## Screens touched
- Today / Home Dashboard
- Schedule / Published Schedule
- Prep & Tasks
- Inventory
- Recipes & Menu Cost
- Financials / Back Office
- Settings
- System Administrator
- Mobile app shell / bottom navigation handling

## Production notes
- This pass is live-data-first, not mock-data-first. Charts now render from available app collections and computed totals.
- If a restaurant has no sales, punch, recipe, scan, burn, backup, push, or admin log data, those cards will show zero/empty states until real data exists.
- The mobile fix intentionally allows horizontal scrolling only inside true wide tables/schedule grids. The overall page should not shove sideways.

## Known limitations
- Live browser/Firebase QA still needs to be run in the real preview/production environment with real credentials.
- `npm run build` requires installed dependencies, including `react-scripts`.
- Internal System Administrator global metrics depend on the signed-in account having permission to read those global collections.

## 15.1.10 Hotfix: No-env cron guard
- Restored the previous no-env behavior for deployments where `/api/dispatch-reminders` is hit by Vercel Cron but Firebase Admin credentials are not exposed in that deployment scope.
- Missing Admin credentials now skip the cron dispatch safely instead of throwing a production error.
- Real reminder/push dispatch still runs normally when server credentials are present.
