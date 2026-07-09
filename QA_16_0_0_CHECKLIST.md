# QA Checklist - 86 Chaos 16.0.0

## Desktop redesign smoke test

- [ ] Open the app on desktop and confirm the new left-side command navigation rail appears.
- [ ] Confirm the 86 Chaos logo is visible in the desktop rail.
- [ ] Confirm the active tab is highlighted with the orange gradient command style.
- [ ] Confirm the top command bar shows the current section name.
- [ ] Click the top search action and confirm global search opens.
- [ ] Confirm the live command overview cards render above the main content.
- [ ] Open Manager Brief, Time Clock & Schedule, Prep, Inventory, Settings, and System Administrator and confirm each renders inside the new command-center stage.
- [ ] Confirm no page has unexpected horizontal scrolling.

## Mobile redesign smoke test

- [ ] Open on a phone-width screen and confirm the desktop rail is hidden.
- [ ] Confirm the top bar fits and does not crush the logo/menu controls.
- [ ] Confirm the mobile quick-navigation strip scrolls horizontally.
- [ ] Tap several quick-nav chips and confirm tabs switch correctly.
- [ ] Open the hamburger menu and confirm the drawer opens from the left.
- [ ] Confirm drawer buttons remain easy to tap.
- [ ] Confirm the floating voice button does not block important controls more than before.

## Feature regression

- [ ] Log in and switch workspace if multiple workspaces exist.
- [ ] Create or edit a harmless prep item, then undo/delete it.
- [ ] Open Schedule Builder and verify the schedule still loads.
- [ ] Open Inventory and verify inventory rows still load.
- [ ] Open Message Board and verify messages still load.
- [ ] Open System Administrator and run Health Checks.
- [ ] Run Gemini Manual once.
- [ ] Refresh Backup Center.

## Branding

- [ ] Confirm 86 Chaos branding is always visible.
- [ ] Confirm restaurant/customer logos can appear beside 86 Chaos branding when configured.
- [ ] Confirm restaurant/customer logos do not replace or hide 86 Chaos branding.

## Deploy notes

- [ ] Redeploy through Vercel.
- [ ] No Firestore rules publish needed.
- [ ] No Storage rules publish needed.
- [ ] No new env vars needed.
