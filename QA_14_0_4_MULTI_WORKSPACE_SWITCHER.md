# QA Checklist: 86 Chaos 14.0.4 Multi-Workspace Switcher

## Version / deployment

- [ ] Confirm `public/version.json` reports `14.0.4`.
- [ ] Confirm the app header/footer/version display reports `14.0.4`.
- [ ] Deploy through GitHub/Vercel.
- [ ] Publish the included `firestore.rules` to the matching Firebase project.

## Single-workspace regression

- [ ] Log in as a normal one-restaurant employee.
- [ ] Confirm no workspace picker appears.
- [ ] Confirm schedule, time clock, messages, tasks, and Help Center still open normally.
- [ ] Confirm clock-in/clock-out and mandatory tip declaration still work.

## Multi-workspace login

- [ ] Add an employee email that already exists in another restaurant to the current Staff Roster.
- [ ] Confirm the app links the existing login instead of showing a new temporary password.
- [ ] Log in with that employee's existing credentials.
- [ ] Confirm the workspace picker appears with both restaurant options.
- [ ] Select restaurant A and confirm only restaurant A data is visible.
- [ ] Log out/in again and select restaurant B.
- [ ] Confirm only restaurant B data is visible.

## Header switcher

- [ ] Log in as a user with two active workspaces.
- [ ] Confirm the active restaurant name appears in the header with `Switch`.
- [ ] Switch workspaces from the header.
- [ ] Confirm the active tab resets safely and data reloads for the selected restaurant.
- [ ] Confirm no data from the previous workspace remains visible after switching.

## Staff Roster / membership behavior

- [ ] Add an existing 86 Chaos email to a second restaurant.
- [ ] Confirm the toast says the workspace was linked and does not show a blank password.
- [ ] Edit that staff member's role/permissions/wage in restaurant B.
- [ ] Confirm restaurant A role/permissions/wage are not changed.
- [ ] Remove that staff member from restaurant B.
- [ ] Confirm they can still log in to restaurant A.
- [ ] Remove the same staff member from their final active workspace and confirm Firebase Auth is disabled only then.

## Presence / Live Users

- [ ] Log in as the same employee in restaurant A and leave the app open for 30 seconds.
- [ ] Confirm Live Users shows that employee in restaurant A.
- [ ] Switch to restaurant B and wait for heartbeat.
- [ ] Confirm Live Users shows activity under restaurant B without overwriting or leaking restaurant A data.

## Permissions / security

- [ ] Confirm regular employees cannot add/remove staff in any workspace.
- [ ] Confirm managers/admins can manage only their active workspace roster.
- [ ] Confirm Firestore denies direct reads/writes to a workspace the account is not a member of.
- [ ] Confirm Safe Write/API actions use the selected workspace, not a stale default restaurant.

## Demo/privacy check

- [ ] Confirm demo mode still hides private employee emails, phones, addresses, wages, and sensitive admin data.
- [ ] Confirm switching workspaces is not exposed inside customer demo mode unless intentionally supported later.
