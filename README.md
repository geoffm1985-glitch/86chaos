# 86 Chaos

Current version: 15.0.5

## 15.0.5 focus

This build keeps the 15.0.4 Menu Intelligence review controls intact, then reduces Firebase reads/writes for presence tracking:

- Removed constant live presence listeners from the main app shell.
- Replaced the repeating browser heartbeat with a low-frequency app-open presence check-in.
- `/api/presence-heartbeat` now writes only one stable `livePresence` document per user/workspace and no longer writes `presenceSessions`.
- Added `/api/presence-snapshot` so System Administrator can press **Refresh Snapshot** for a one-time Super Admin-only presence read.
- Regular staff and store managers no longer see online status in Team/Staff Roster.
- Firestore rules now restrict `livePresence` and `presenceSessions` reads to Super Admin only.
- System Administrator wording was updated, but no 15.0.5 release note was added to the public Help Center.

## Deploy notes

1. Deploy the updated app through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.5` after deploy.
3. Publish the included Firestore rules.
4. Open the app as a normal user and confirm Team does not show online/heartbeat status.
5. Open System Administrator → Live and press **Refresh Snapshot** to fetch the one-time presence snapshot.
6. Confirm `/api/presence-heartbeat` reports `written: ["livePresence"]` if tested directly.
7. Run the 15.0.5 QA checklist before handing it to staff.

## Separate publish/deploy requirements

- Firestore rules: yes, publish the included `firestore.rules`.
- Storage rules: no new changes from 15.0.4.
- Vercel/API routes: yes, deploy the updated app and API routes.
- New Vercel env vars: none.
