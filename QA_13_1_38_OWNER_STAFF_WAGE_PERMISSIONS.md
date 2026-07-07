# QA Checklist - 13.1.38 Owner Staff + Wage Permissions

## Required

- [ ] Deploy to Vercel Preview.
- [ ] Publish the included firestore.rules to the matching Firebase project.
- [ ] Log out and back in as the restaurant account owner.

## Owner tests

- [ ] Account owner can open Staff Roster.
- [ ] Account owner can add a new staff member.
- [ ] Account owner can edit another staff member's wage.
- [ ] Account owner can edit their own wage.
- [ ] Account owner can toggle View Wages and Edit Wages permissions.
- [ ] Account owner can save Workspace wage visibility/edit access.

## Manager/admin tests

- [ ] Manager/admin without wage permission can edit staff basics if allowed.
- [ ] Manager/admin without wage permission cannot see wage values.
- [ ] Manager/admin without wage permission cannot change wage access toggles.
- [ ] User with View Wages can see wage labels/labor costs.
- [ ] User with Edit Wages can edit wage values.

## Staff tests

- [ ] Regular staff can view Staff Roster read-only.
- [ ] Regular staff cannot add/edit/reset/delete staff.
- [ ] Regular staff cannot see wages.

## Regression

- [ ] Staff Roster still shows last active status.
- [ ] Existing permissions like schedule, inventory, prep, team, and labor still save.
- [ ] Firestore does not allow anyone to set isSuperAdmin from Staff Roster.
