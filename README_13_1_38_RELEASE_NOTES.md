# 86 Chaos 13.1.38 Release Notes

## Owner Staff + Wage Permission Repair

- Fixed account-owner staff management so the restaurant owner can add staff and update staff profiles.
- Account owners can edit wages, including their own wage.
- Added separate wage access controls for View Wages and Edit Wages.
- Only account owners and Super Admin can grant or remove wage visibility/edit access.
- Staff Roster hides wage values and wage inputs from users without wage access.
- Staff saves now send clearer permission messages when Firebase blocks sensitive fields.
- Firestore rules now recognize restaurant ownership for staff creation, wage updates, and wage-access changes while still protecting Super Admin/system fields.

## Deploy Notes

Publish the included firestore.rules to the same Firebase project used by this deployment.
