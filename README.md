# 86 Chaos

Current Version: 15.0.18 - Mobile & Paperwork Polish

# 86 Chaos

Current version: **15.0.14**

## 15.0.14 focus

15.0.14 is a reliability and review-control update. It adds a dedicated AI Tools area, stronger problem reporting with device diagnostics, offline queue visibility, a full Vercel API route health manifest, and per-ingredient confidence/review controls in Menu Intelligence.

## What changed

- **AI Tools area:** Added a dedicated AI Tools screen with shortcuts to Menu Intelligence, Invoice Scanner, voice commands, and Smart Prep Matching.
- **Problem reporting:** Added an app-shell Report Problem flow. Error-style toasts now offer a Report Problem action, and reports include device diagnostics.
- **Device diagnostics:** Problem reports capture app version, Firebase project, host, online status, service worker support, notification permission, camera/mic support, local storage status, screen size, and offline queue count.
- **Offline queue visibility:** The app shell now shows when offline writes are queued and can attempt a replay from the support/report flow.
- **API route health checks:** Added `/api/health-checks` and wired System Administrator → Health Dashboard to show a full Vercel API route manifest.
- **Menu Intelligence review polish:** Review rows now show confidence badges and an Approve/Skip toggle for each ingredient. Skipped rows are not saved as menu-impact links.
- **Help Center/Admin Manual:** Release notes and administrator instructions were updated for this release.

## Deploy steps

1. Deploy this app through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.14`.
3. Open System Administrator → Health Dashboard and press **Refresh Health**.
4. Confirm `/api/health-checks` returns the API route manifest and route rows show as ready.
5. Open **AI Tools** from the drawer and confirm shortcuts route correctly.
6. Use the header bug button or an error toast to confirm problem reports include diagnostics.
7. In testing, scan a menu and confirm each ingredient shows confidence plus Approve/Skip before saving.

## Separate publishing required

- **Firestore rules:** no changes in this release.
- **Storage rules:** no changes in this release.
- **Vercel/API routes:** yes. Deploy required for the new `/api/health-checks` route and updated frontend.
- **Vercel env vars:** no new required env vars.

## Still not completed

This release does **not** complete full MFA enrollment/enforcement, automated Firebase rules tests, full E2E tests, full setup wizard, owner dashboard, recurring prep templates, professional demo mode, or full mobile cleanup across every screen.

Latest Build: 15.0.18 - Mobile & Paperwork Polish
