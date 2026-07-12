# QA 15.0.56 Push Restaurant Groups

## Build checks

- [x] React optimized production build passed.
- [x] Firebase Functions TypeScript build passed.
- [x] API syntax checks passed.
- [x] JS/JSX parse checks passed.
- [x] JSON parse checks passed.
- [x] Firestore/Storage rule brace checks passed.

## Manual QA required after Vercel preview deploy

### Push Control Center

- [ ] Open System Administrator → Push Control Center as Master Admin/System Admin.
- [ ] Confirm the Targeted Push Broadcast card appears above the repair center.
- [ ] Select **One workspace** and confirm counts update.
- [ ] Select **Restaurant group** and confirm group options appear.
- [ ] Confirm the selected group preview shows the matched workspaces.
- [ ] Select **All workspaces** and confirm the warning text appears.
- [ ] Send a harmless test message to one workspace.
- [ ] Send a harmless test message to one restaurant group.
- [ ] Confirm result toast shows sent count, failed count if any, and workspace count.
- [ ] Confirm stale token cleanup still works when Firebase reports invalid tokens.
- [ ] Confirm auditLogs receives `PUSH_WORKSPACE_NOTIFICATION_SENT` and/or `PUSH_GROUP_BROADCAST_SENT`.

### Permission/security QA

- [ ] Confirm non-System Administrator users cannot access System Administrator Push Control Center.
- [ ] Confirm multi-workspace `restaurantIds` requests are rejected for non-internal users.
- [ ] Confirm a regular workspace manager can still only send allowed single-workspace push requests where existing workflows call `/api/send-push`.
- [ ] Confirm group push does not expose OAuth, API keys, POS provider setup, or customer integrations.

### Regression QA

- [ ] Existing single-user Send Test still works.
- [ ] Push diagnostic export still downloads.
- [ ] Request Reconnect still works.
- [ ] Force Refresh still works.
- [ ] Prune + Repair Stale still works.
- [ ] Desktop layout still feels less clunky from 15.0.55.
- [ ] Plan gates and Founder Beta behavior still work from 15.0.54.
