# 86 Chaos 13.1.4 QA Checklist

## Login popup tests

- [ ] Add employee from Staff Roster on PC.
- [ ] Confirm popup shows generated email and temporary password.
- [ ] Copy button works.
- [ ] Print button works.
- [ ] Email button opens email draft.
- [ ] Text button opens SMS on supported devices.
- [ ] Close popup and confirm temp password does not show again.
- [ ] Confirm Firestore user profile does not store plain `password`.
- [ ] Deploy workspace from System Administrator.
- [ ] Confirm owner login popup appears.
- [ ] Confirm owner password is not stored in Firestore profile.

## Clock-out geofence tests

- [ ] Turn geofence on in Settings and set lat/lon/radius.
- [ ] Clock out inside the area and confirm normal punch.
- [ ] Clock out outside the area and confirm warning appears.
- [ ] Continue anyway and confirm punch saves.
- [ ] Confirm manager alert appears.
- [ ] Confirm Financials → Timesheets shows manager note on the punch.
- [ ] Deny browser location and confirm punch still saves with review note.

## Voice command tests

- [ ] Say: "prep 2 of ranch" and confirm qty is 2 and name is ranch.
- [ ] Say: "add tomatoes to prep list" and confirm saved name is tomatoes, not the command text.
- [ ] Say: "show Friday schedule" and confirm it opens full schedule / published schedule view, not Schedule Builder.
- [ ] Confirm safe voice commands require fewer clicks.
- [ ] Confirm microphone button shows BETA.

## Schedule Builder tests

- [ ] Create a custom restaurant role.
- [ ] Open Schedule Builder → Coverage Targets.
- [ ] Confirm the role appears in the coverage target role dropdown.
- [ ] Confirm the role appears in template row role dropdown.

## Demo mode tests

- [ ] Open System Administrator → Clients.
- [ ] Select a workspace.
- [ ] Choose Safe Demo Mode options.
- [ ] Start Demo Manager.
- [ ] Confirm System Administrator is hidden.
- [ ] Confirm System Audit is hidden.
- [ ] Confirm selected tabs only are visible.
- [ ] Confirm email/phone/address/wage fields are hidden or masked.
- [ ] Try to save, add, publish, delete, or clock and confirm it is blocked.
- [ ] Exit demo mode from the top banner.
- [ ] Start Demo Employee.
- [ ] Confirm it looks like a regular employee view.
- [ ] Confirm sensitive contact info stays hidden.

## Permission / routing tests

- [ ] Rename check: menu says Time Clock & Schedule.
- [ ] Direct URL to Financials works only for Super Admin, Store Manager, Labor permission, or Sales permission.
- [ ] Schedule Manager without Labor/Sales cannot direct-open Financials.
- [ ] Direct URL to Schedule Builder works only with proper schedule/admin access.
- [ ] Direct URL to System Administrator does not work in demo mode.
- [ ] Direct URL to System Audit does not work in demo mode.

## Help and version tests

- [ ] Footer shows version 13.1.4.
- [ ] `/version.json` shows 13.1.4.
- [ ] Help Center includes Employee Quick Start.
- [ ] Help Center includes Manager / Restaurant Quick Start.
- [ ] Help Center includes Using 86 Voice beta.
- [ ] Help Center includes Clock-out location review.
- [ ] Help Center includes Safe customer demo mode.
- [ ] Help Center has restart tour buttons.
