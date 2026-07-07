# QA Checklist: 13.1.41 Settings / Branding / Preferences

## Owner Branding

- Log in as the account owner.
- Open Settings → Branding.
- Confirm the app name field is locked as 86 Chaos.
- Change Accent Color and save.
- Refresh the app and confirm the accent color still applies.
- Upload a restaurant logo and save.
- Confirm the 86 Chaos logo still appears and the restaurant logo appears beside it.

## Settings Permissions

- As the account owner, grant Branding permission to a trusted test user.
- Log in as that user and confirm Settings → Branding is visible.
- Remove Branding permission and confirm the tab disappears after refresh/login.
- Repeat for Workspace Settings and Integrations if needed.

## Personal Preferences

- Change table density, quick dock visibility, and destructive-action confirmation preferences.
- Save preferences.
- Refresh and confirm the settings remain saved.

## Firebase Rules

- Publish Firestore rules to the same Firebase project used by the deployment.
- Publish Storage rules to the same Firebase project used by the deployment.
- Confirm logo upload does not show a Storage permission error.

## Regression Checks

- Staff Roster still opens.
- Account owner can still add/edit/remove staff.
- Owner can still edit wages.
- System Administrator tab layout is unchanged.
