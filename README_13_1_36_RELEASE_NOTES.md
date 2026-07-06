# 86 Chaos 13.1.36 Release Notes

## Admin Command Center + Mobile Layout

- Reworked the System Administrator tab into a cleaner command-center layout with grouped sections for Overview, Customer Operations, Support & Safety, and Reference.
- Added a mobile-first administrator layout so phones open to a compact section picker instead of one long scroll.
- The Command Deck now defaults closed on mobile and can be opened only when needed.
- Added a compact mobile section selector, quick section buttons, and a current-section header.
- Desktop keeps the professional grouped navigation and signal board layout.
- Existing admin tools remain in their current feature areas: Workspaces, People, Health Dashboard, Live Activity, Forensics & Backups, Platform Operations, Access Control, and Administrator Manual.
- Updated Administrator Manual and Help Center release notes for the new admin layout.

## Files Changed

- `src/features/management.jsx`
- `src/core/appCore.js`
- `public/version.json`
- `README.md`

## Deploy Notes

No Firebase rules, Storage rules, API routes, Vercel config, or environment variable changes are required.
