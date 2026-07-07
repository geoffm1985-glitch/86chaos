# QA 13.1.39 - Owner Staff + Wage Save Repair

## Owner account
- [ ] Log in as the restaurant account owner.
- [ ] Open Staff Roster.
- [ ] Edit the owner's own profile and change hourly wage.
- [ ] Save succeeds without `Missing or insufficient permissions`.
- [ ] Refresh and confirm the new wage remains saved.
- [ ] Add a new staff member with a wage.
- [ ] Confirm the one-time login info appears.
- [ ] Edit another staff member's wage.
- [ ] Toggle `View Wages` for a trusted user.
- [ ] Toggle `Edit Wages` for a trusted user.
- [ ] Confirm `Edit Wages` also grants/keeps `View Wages`.

## Existing failed employee-account repair
- [ ] Try adding an employee email that already exists from a previous failed create.
- [ ] Confirm the app repairs/links the profile or shows a clear error.
- [ ] Confirm a fresh temporary password is shown if repaired.

## Manager/admin without owner access
- [ ] Log in as a non-owner manager/admin with staff management access.
- [ ] Edit a staff member's name/phone/role.
- [ ] Confirm wage fields are hidden or not editable unless that user has wage edit permission.
- [ ] Confirm the manager/admin cannot grant `View Wages` or `Edit Wages` unless they are the owner.

## Regular staff
- [ ] Log in as regular staff.
- [ ] Confirm Staff Roster is view-only.
- [ ] Confirm Add/Edit/Delete staff tools do not appear.
- [ ] Confirm wage values do not appear without wage view permission.

## Backend/security
- [ ] Confirm Vercel deployed `api/staff-member.js`.
- [ ] Publish the included Firestore rules.
- [ ] Confirm a staff creation or wage edit appears in audit/forensics logs.
