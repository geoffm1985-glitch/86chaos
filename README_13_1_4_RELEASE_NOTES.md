# 86 Chaos 13.1.4 Existing Components Release

This build was merged into the uploaded app's existing structure instead of rebuilding the app as a separate single-file package.

## Updated areas

- `src/App.js`
- `src/components/common.jsx`
- `src/features/management.jsx`
- `src/features/schedule.jsx`
- `src/components/TabTeam.js` safety cleanup for legacy component file
- `src/components/TabGodMode.js` safety cleanup for legacy component file
- `api/deploy-tenant.js`
- `api/firestore-backup.js`
- `public/version.json`
- `storage.rules`

## Employee and workspace login popups

- Adding an employee now shows a one-time popup with the generated email and temporary password.
- Deploying a workspace now shows a one-time popup with the owner email and temporary password.
- Copy, print, email, and text buttons were added.
- Temporary passwords are no longer stored in Firestore user profile records.

## Clock-out geofence review

- Employees can still clock out when outside the required area.
- They receive a warning and can cancel or continue.
- If they continue, the time punch is marked for manager review.
- A manager alert is posted to events/messages.
- A push alert is attempted through `/api/send-push`.
- Financials → Timesheets shows the manager note on the punch row.

## First-run tours

- New employees get an Employee Quick Start tour.
- New restaurant/workspace admins get a Manager Quick Start tour.
- Help Center includes restart tour buttons.
- Tours explain adding the web app to phone/PC, clocking in/out, schedule, permissions, backups, and Help Center.

## Voice command beta polish

- The microphone button now shows a BETA tag.
- The dock starts listening when opened to reduce clicks.
- Safe commands auto-run instead of requiring another confirmation.
- Prep commands strip command words like "add to prep list" from the saved item name.
- "Prep 2 of ranch" saves quantity `2` and item text `ranch`.
- Schedule voice commands open the full schedule under Time Clock & Schedule, not Schedule Builder.

## Scheduling polish

- The menu tab was renamed from Time Clock & Shifts to Time Clock & Schedule.
- Coverage target roles are populated from restaurant-created roles, with staff roles and standard restaurant roles as fallback.

## Demo mode

- System Administrator → client workspace modal now includes Safe Demo Mode.
- You can choose demo tier, visible tabs, manager view, or regular employee view.
- Demo mode hides System Administrator and System Audit.
- Demo mode masks emails, phone numbers, addresses, emergency contacts, and wages.
- Demo mode is read-only and blocks save/add/delete/publish/clock/edit style actions.
- A top banner clearly shows demo mode and includes EXIT DEMO.

## Security and production notes

- Firebase Storage fallback is locked down in `storage.rules`.
- `api/deploy-tenant.js` now supports `FIREBASE_SERVICE_ACCOUNT_KEY` as well as split Firebase credential env vars.
- Financials direct access no longer grants access from Schedule permission alone.
- Backup metadata version was updated to 13.1.4.

## Validation note

A TypeScript/JSX syntax transpile check passed across `src` and `api`. A full `npm run build` could not be completed in the sandbox because dependency installation timed out. Deploy this ZIP to a staging branch and run:

```bash
npm install
npm run build
```

Then test the QA list before promoting to production.
