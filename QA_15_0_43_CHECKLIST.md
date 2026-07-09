# QA Checklist - 86 Chaos 15.0.43

## Visual smoke test
- [ ] Open the app on desktop and confirm the darker 86 Chaos command-center background appears.
- [ ] Confirm the top header uses the cleaner dark/orange style.
- [ ] Open the side menu and confirm the drawer is wider, darker, and easier to scan.
- [ ] Confirm active menu buttons use orange gradient styling.
- [ ] Confirm cards/panels across Manager Brief, Prep, Inventory, Schedule, System Administrator, and Settings still render correctly.
- [ ] Confirm form fields, selects, and textareas are readable and focus with the orange outline.
- [ ] Confirm tables still scroll on mobile when needed.
- [ ] Confirm the 86 Chaos logo always remains visible.
- [ ] Confirm a configured restaurant/customer logo still appears beside 86 Chaos branding on desktop.

## Mobile
- [ ] Open on a phone-width screen and confirm the header fits without horizontal scrolling.
- [ ] Confirm touch targets remain comfortable.
- [ ] Open System Administrator and verify mobile cards/buttons are readable.
- [ ] Confirm the floating voice preview button does not block primary controls more than before.

## Regression
- [ ] Log in and switch workspace if multiple workspaces exist.
- [ ] Run System Administrator → Health Checks.
- [ ] Run Gemini Manual once.
- [ ] Run Backup Center refresh.
- [ ] Create or edit a harmless prep item, then undo/delete it.

## Deploy notes
- [ ] Redeploy through Vercel.
- [ ] No Firestore rules publish needed.
- [ ] No Storage rules publish needed.
- [ ] No new env vars needed.
- [ ] Confirm Vercel deploy logs no longer warn that `memory` settings in `vercel.json` are ignored.
