# 86 Chaos 16.0.2 QA Checklist

## Completed Local Checks

- [x] Used the uploaded ZIP as the source of truth and kept the same source package shape.
- [x] Updated `CURRENT_VERSION` to `16.0.2`.
- [x] Preserved existing tab IDs and labels:
  `today`, `published`, `labor`, `ops`, `messages`, `events`, `prep`, `recipes`, `inventory`, `schedule`, `team`, `maintenance`, `sales`, `godmode`, `audit`, `help`, `settings`.
- [x] Preserved existing drawer menu permission gates before visual grouping.
- [x] Verified System Administrator remains the `godmode` tab and appears in the System drawer group for super-admin users.
- [x] Kept 86 Chaos logo visible and mandatory in shared logo lockups.
- [x] Added optional customer logo support beside the 86 Chaos mark without replacing it.
- [x] Improved mobile drawer width, touch targets, modal close targets, search rows, and quick action buttons.
- [x] Ran JSX syntax/parse checks with the bundled Node runtime and Playwright Babel parser.
- [x] Ran ZIP integrity check after packaging.

## Build Status

- [ ] Production build: not run from this source-only ZIP because the uploaded archive does not include `package.json`, `public`, `api`, Firebase/Vercel config, or installed dependencies.

## Manual QA Recommended In Full App Repo

- [ ] Copy updated `src` into the full app repo.
- [ ] Update hosted `public/version.json` to `{"version":"16.0.2"}`.
- [ ] Run dependency install/build in the full app repo.
- [ ] Desktop: open drawer and verify every permitted existing tab appears once.
- [ ] Mobile: open drawer, search menu, navigate to each permitted tab, and verify the drawer closes correctly.
- [ ] Super Admin: verify System Administrator is visible, opens `godmode`, and remains organized under System.
- [ ] Manager/Admin: verify Schedule Builder, Labor & Timesheets, Daily Ledger, Staff Roster, Settings, Audit, and Help remain reachable according to permissions.
- [ ] Staff/Kitchen: verify Time Clock & Shifts, Message Board, Prep, Recipes, and other permitted modules remain reachable.
- [ ] Verify date navigation still works for schedule/events/published/sales/prep views.
- [ ] Verify modals, drawers, tables, inputs, buttons, badges, and cards use the upgraded visual system without hiding critical controls.
