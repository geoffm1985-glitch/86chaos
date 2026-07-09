# 86 Chaos 15.0.35 - Administrator Layout Polish

## What changed
- Moved System Administrator section buttons into a left-side admin menu on desktop.
- Added a collapsible mobile Admin Menu for phones and tablets.
- Moved the Command Deck / signal information board to the top of System Administrator.
- Kept the information board collapsible with Show Info Board / Hide Info Board controls.
- Updated the Administrator Manual with a 15.0.35 layout article.

## Files touched
- src/features/management.jsx
- src/core/appCore.js
- api/firestore-backup.js
- api/full-system-diagnostics.js
- api/security-diagnostics.js
- api/master-admin-repair.js
- package.json
- public/version.json
- README.md
- QA_15_0_35_CHECKLIST.md

## Deployment notes
- Firestore rules: no changes.
- Storage rules: no changes.
- API routes: redeploy through Vercel so version metadata stays aligned.
- Vercel env vars: no new required variables.
