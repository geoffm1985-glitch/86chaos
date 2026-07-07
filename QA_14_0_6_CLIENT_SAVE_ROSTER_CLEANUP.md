# QA Checklist: 86 Chaos 14.0.6 Client Save & Roster Cleanup

## System Administrator → Workspaces
- [ ] Log in as a Super Admin.
- [ ] Open System Administrator → Workspaces.
- [ ] Click Manage on a client/workspace.
- [ ] Change a safe setting such as plan, billing status, module toggle, or owner phone.
- [ ] Click Save Configuration.
- [ ] Confirm the save completes without the unsupported `undefined` Firestore error.
- [ ] Reopen the same client and confirm the changed settings persisted.
- [ ] Open setup/history tools if used and confirm a settings history snapshot still appears.

## Staff Roster
- [ ] Log in as a regular staff account without staff-management permission.
- [ ] Open Staff Roster.
- [ ] Confirm the old blue read-only banner is gone.
- [ ] Confirm the roster list and live presence information still show.
- [ ] Confirm the add/edit staff form is still hidden from regular staff.
- [ ] Log in as a manager/admin and confirm staff add/edit/reset/remove tools still show.

## Regression
- [ ] System Administrator → People → Support Edit still opens normally.
- [ ] System Administrator → Workspaces → Users drawer still opens normally.
- [ ] Live Users / presence still reports online users.
- [ ] No public Help Center article exposes Forensics or sensitive System Administrator internals.
