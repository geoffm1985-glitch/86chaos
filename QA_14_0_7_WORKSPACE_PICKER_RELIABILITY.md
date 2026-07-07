# QA Checklist: 86 Chaos 14.0.7 Workspace Picker Reliability

## Login picker

- [ ] Add or confirm one employee email is active in two restaurant workspaces.
- [ ] Log out fully.
- [ ] Log back in with that same email/password.
- [ ] Confirm the Choose Workspace screen appears before entering the app.
- [ ] Choose restaurant A and confirm the header shows restaurant A.
- [ ] Log out and log back in again.
- [ ] Choose restaurant B and confirm the header shows restaurant B.

## Remembered session / header switcher

- [ ] With Remember Me enabled, refresh the browser after login.
- [ ] Confirm the app refreshes memberships and the header shows “Switch” when more than one workspace is active.
- [ ] Tap the header workspace name / Switch control.
- [ ] Confirm both restaurants appear in the Switch Workspace modal.
- [ ] Switch restaurants and confirm schedule/team/tasks data changes to the selected workspace.

## Single workspace safety

- [ ] Log in with a staff account that belongs to only one restaurant.
- [ ] Confirm it does not get forced through a picker.
- [ ] Confirm no Switch control appears in the header.

## Permissions/data isolation

- [ ] Confirm role/permissions match the selected restaurant, not the employee’s other job.
- [ ] Confirm Time Clock uses the selected workspace.
- [ ] Confirm Staff Roster only shows staff for the selected workspace.
- [ ] Confirm Live Users presence is recorded under the selected workspace.

## API route

- [ ] Confirm `/api/workspace-memberships` is live after deploy.
- [ ] Confirm Vercel has the same Firebase Admin env vars used by the other 14.x API routes.
