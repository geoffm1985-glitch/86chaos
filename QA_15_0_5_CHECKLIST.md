# 86 Chaos 15.0.5 QA Checklist

## Version

- [ ] Deploy the app.
- [ ] Confirm `/version.json` shows `15.0.5`.
- [ ] Confirm the footer/app version shows `15.0.5`.

## Team privacy

- [ ] Log in as a regular staff user.
- [ ] Open Team/Staff Roster.
- [ ] Confirm there is no online, heartbeat, or live-presence status shown.
- [ ] Log in as a manager/store admin.
- [ ] Confirm Team still works for roster management, but does not show live online status.

## Manual presence snapshot

- [ ] Log in as the Super Admin.
- [ ] Open System Administrator → Live.
- [ ] Confirm the page does not auto-load live presence details before pressing the button.
- [ ] Press **Refresh Snapshot**.
- [ ] Confirm one snapshot result appears with recent app check-ins.
- [ ] Confirm the button can be pressed again manually and does not open a live listener.

## Firebase/API cost controls

- [ ] In browser dev tools or Vercel logs, confirm the app is not calling `/api/presence-heartbeat` every minute.
- [ ] Confirm `/api/presence-heartbeat` returns `written: ["livePresence"]` and does not write `presenceSessions`.
- [ ] Confirm `/api/presence-snapshot` is only accessible to the Super Admin.
- [ ] Confirm Firestore rules have been published so non-Super Admin users cannot read `livePresence` or `presenceSessions`.

## Regression checks

- [ ] Menu Intelligence scan progress from 15.0.4 still works.
- [ ] Approve Reviewed Menu Links still blocks duplicate clicking.
- [ ] Invoice bulk-save notifications from 15.0.3 still show one summary notification.
- [ ] Reminder dispatch and 20MB scanner limits from 15.0.2 still work.
