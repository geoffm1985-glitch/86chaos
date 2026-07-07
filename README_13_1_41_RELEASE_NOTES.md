# 86 Chaos 13.1.41 Release Notes

## Settings / Preferences Branding & Access

- Fixed workspace accent color so the saved color actually applies across the app shell.
- Added **Settings → Branding** for account owners and users granted Branding access.
- Added restaurant logo upload from Settings while keeping the 86 Chaos name and core 86 Chaos logo locked in place.
- Added owner-controlled display defaults: restaurant/group display name, help contact, login/help message, timezone, date format, time format, currency, week start, and default staff landing tab.
- Added owner-only **Settings Access** controls for granting Workspace Settings, Branding, and Integrations permissions to trusted users.
- Added personal preference options for table density, quick dock visibility, and destructive-action confirmations.
- Updated staff permission handling so Settings, Branding, and Integrations permissions can be granted safely without changing the System Administrator tab.
- Added Storage rules for restaurant brand logo assets.

## Deployment Notes

- Publish `firestore.rules` after deploying this build.
- Publish `storage.rules` after deploying this build so logo uploads work.
- No new Vercel environment variables are required.
