# 86 Chaos

Current build: 13.1.27

## 13.1.27 focus

This build tightens Staff Roster permissions while keeping the roster useful for the whole team.

- Regular staff can open Staff Roster and view active coworkers.
- Staff edit controls are hidden unless the signed-in user is a manager/admin account.
- Staff Roster last-active status now reads from all presence heartbeat fields instead of only one stale field.
- Voice/menu navigation can open Staff Roster for regular staff without exposing edit tools.

## Deploy notes

Deploy through the normal GitHub → Vercel flow.

Changed deployable files:

- `src/features/management.jsx`
- `src/components/common.jsx`
- `src/components/TabTeam.js`
- `src/core/appCore.js`
- `public/version.json`
- `api/firestore-backup.js`
- `api/full-system-diagnostics.js`

No Firestore rules, Storage rules, API route behavior, or Vercel environment variable changes are required for this version.
