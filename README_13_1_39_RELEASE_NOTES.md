# 86 Chaos 13.1.39 Release Notes

## Owner Staff + Wage Save Repair

This release fixes the owner-account staff save path when Firestore client rules reject sensitive payroll/profile updates.

### Changed
- Added `api/staff-member.js`, a verified server-side staff management route.
- Staff Roster now saves staff creates/updates through the server route instead of relying only on client Firestore writes.
- Account owners and Super Admin can add staff members.
- Account owners and Super Admin can edit wages, including their own wage.
- Only account owners and Super Admin can choose who gets `View Wages` or `Edit Wages` access.
- Managers/admins with staff access can still edit staff basics, but cannot grant wage access unless they are the owner.
- If an employee Auth account exists from a previously failed add-staff attempt, the server route can relink/repair the user profile and issue a fresh temporary password.
- Staff creation and wage updates now write audit records for Forensics.
- Firestore rules now recognize owner profile flags (`isOwner` / `accountOwner`) as owner proof and protect those flags from self-editing.

### Requires after deploy
- Deploy the updated Vercel API route: `api/staff-member.js`.
- Publish the included `firestore.rules` to the same Firebase project used by the live/preview app.
