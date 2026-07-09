# 86 Chaos 15.0.43 Release Notes

## Marketing Mockup App Reskin

This release updates the live app styling to more closely match the 86 Chaos marketing mockup direction: a darker command-center shell, hotter orange accents, cleaner cards, stronger depth, and more polished mobile/desktop surfaces.

### Changed
- Updated the core app theme constants to use the 86 Chaos orange/black command-center palette.
- Added a `chaos-command-theme` shell around the app.
- Restyled the main header, card panels, drawers, tables, inputs, buttons, scrollbars, and footer to better match the generated mockup.
- Updated the slide-out menu to feel more like the mockup device navigation.
- Preserved the existing React/Firebase/Vercel structure and all existing app behavior.
- Removed ignored Vercel `memory` entries from `vercel.json`; `maxDuration` settings remain.
- Kept 86 Chaos branding mandatory and visible. Customer restaurant logos still display beside it when configured.

### Deployment notes
- Redeploy on Vercel.
- `vercel.json` changed only to remove ignored `memory` settings and keep valid cron/function duration settings.
- No Firestore rules publish required.
- No Storage rules publish required.
- No new environment variables required.
