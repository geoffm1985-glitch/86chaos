# 86 Chaos 16.0.2 QA Checklist

## Completed Local Checks

- [x] Used the 16.0.2 source overlay as the redesign source of truth.
- [x] Used the 15.0.43 full project as the build harness for `api`, `public`, Firebase rules, Storage rules, Vercel config, assets, and package metadata.
- [x] Updated `CURRENT_VERSION` to `16.0.2`.
- [x] Updated `package.json` to `16.0.2`.
- [x] Updated `public/version.json` to `16.0.2`.
- [x] Verified built `build/version.json` is `16.0.2`.
- [x] Preserved existing drawer tab IDs and labels:
  `today`, `published`, `labor`, `ops`, `messages`, `events`, `prep`, `recipes`, `inventory`, `schedule`, `team`, `maintenance`, `sales`, `godmode`, `audit`, `help`, `settings`.
- [x] Preserved existing drawer menu permission gates before visual grouping.
- [x] Verified System Administrator remains the `godmode` tab and appears in the System drawer group for super-admin users.
- [x] Kept 86 Chaos logo visible and mandatory in shared logo lockups.
- [x] Added optional customer logo support beside the 86 Chaos mark without replacing it.
- [x] Improved mobile drawer width, touch targets, modal close targets, search rows, and quick action buttons.
- [x] Ran JSX syntax/parse checks across the full harness: 33 JS/JSX files parsed successfully.
- [x] Installed dependencies with pnpm using dependency scripts ignored to avoid pnpm's interactive build-script approval guard.
- [x] Ran production build successfully.
- [x] Ran ZIP integrity check after packaging: 117 entries read successfully; no `node_modules` or 15.0.43 docs included.

## Production Build Result

- [x] `react-scripts build` compiled successfully.
- Gzipped output:
  - `build/static/js/main.fb2289fa.js` - 359.52 kB
  - `build/static/css/main.301e83f0.css` - 8.19 kB
  - `build/static/js/833.b65855ad.chunk.js` - 3.29 kB

## Manual QA Recommended Before Deploy

- [ ] Desktop: open drawer and verify every permitted existing tab appears once.
- [ ] Mobile: open drawer, search menu, navigate to each permitted tab, and verify the drawer closes correctly.
- [ ] Super Admin: verify System Administrator is visible, opens `godmode`, and remains organized under System.
- [ ] Manager/Admin: verify Schedule Builder, Labor & Timesheets, Daily Ledger, Staff Roster, Settings, Audit, and Help remain reachable according to permissions.
- [ ] Staff/Kitchen: verify Time Clock & Shifts, Message Board, Prep, Recipes, and other permitted modules remain reachable.
- [ ] Verify date navigation still works for schedule/events/published/sales/prep views.
- [ ] Verify modals, drawers, tables, inputs, buttons, badges, and cards use the upgraded visual system without hiding critical controls.
- [ ] Verify Firebase Auth, Firestore reads/writes, Storage uploads, push messaging, and Vercel API routes in the target deployment environment.
- [x] Verify ZIP integrity after packaging.
