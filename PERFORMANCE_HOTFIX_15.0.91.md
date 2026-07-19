# 86 Chaos 15.0.91 Performance Hotfix

## Problem addressed
The app was loading too much JavaScript and too much Inventory-related Firebase data before the user actually needed it. Inventory was especially heavy because the tab opened multiple live listeners and calculated AI ordering data even when the user was only trying to count stock.

## Changes made

### App startup
- Replaced the eager `./features` import in `src/App.js` with route-level `React.lazy` imports.
- The main bundle is now split into feature chunks instead of loading schedule, operations, financials, system admin, help, intelligence, HR, and inventory all at first boot.
- Stopped loading recipe documents on every app boot just for background voice navigation. Recipes now load when opening Recipes or global search.

### Inventory loading
- Removed duplicate top-level Inventory and Menu Intelligence live subscriptions while the Inventory tab is active.
- Inventory now starts with a lighter first Count-tab snapshot.
- Added **Load full list** on Inventory Count.
- Inventory automatically expands to the full configured snapshot when searching, using below-par focus, or opening deeper Inventory sub-tabs.
- Vendors, invoices, burn logs, menu dependencies, events, and prep context now load only when the active Inventory sub-tab needs them.
- Invoice AI usage only checks when the Invoices sub-tab is opened.

### Inventory render cost
- Memoized vendor lookup maps.
- Memoized below-par rows.
- Memoized zero-stock menu impact calculations.
- Memoized grouped inventory rows.
- Memoized selected burn-item calculations.
- Memoized order deficit calculations.
- AI Order Assistant calculations now run only on the AI Order tab.

## Validation
- `npm ci --omit=optional --no-audit --no-fund --progress=false`
- `npm test`
- `npm run rules:check`
- JavaScript syntax checks for `.js` files
- Python syntax checks
- React production build
- Firebase Functions TypeScript build

## Build result
Main JS bundle after gzip: `322.63 kB`.
The previous audit build reported the main app bundle around `890 kB` gzipped, so the first-load JavaScript payload is now materially smaller.

## Manual QA
- Deploy to Vercel Preview.
- Open the app fresh on mobile and desktop.
- Confirm Today/Home loads before heavy feature chunks.
- Open Inventory Count and confirm it appears before invoice/burn/AI data loads.
- Tap **Load full list** and confirm additional inventory rows appear.
- Search Inventory and confirm broader results load.
- Open Order, AI Order, Manage, Vendors, Invoices, and Burn Log and confirm each still works.
- Confirm push, voice, invoices, menu intelligence, and system admin are still gated correctly.

## Not changed
- Firebase service-account-key handling was not changed.
- Firestore rules and Storage rules security hardening from prior audit repairs remain in place.


## 15.0.91 Login Guardrail

The LoginScreen is intentionally eager-loaded. Do not move the unauthenticated login screen back behind React.lazy unless it is wrapped by a Suspense boundary that is active before auth state resolves. Inventory and other workspace tools remain lazy-loaded after login.
