# 86 Chaos 14.0.4 Release Notes

## Version 14.0.4: Multi-Workspace Switcher

### What changed

- Added full multi-workspace support so one Firebase Auth login can belong to more than one restaurant.
- Added a workspace picker after login when a user has multiple active restaurant memberships.
- Added a header workspace switcher so users can change active restaurants without logging out.
- Added the `workspaceMembers` membership model for per-restaurant role, wage, permission, phone, photo, and active-status records.
- Updated Staff Roster so managers can add an existing 86 Chaos email to their restaurant without creating a duplicate login or resetting the employee password.
- Updated staff removal so it deactivates only the current restaurant membership. Firebase Auth is disabled only when no other active workspaces remain.
- Updated live presence and heartbeat writes to use per-workspace user records, preventing one job from overwriting another job's online status.
- Updated server routes and Firestore rules so selected workspace permissions are enforced on backend/admin operations.
- Updated Help Center and Administrator Manual wording for the new workspace behavior.

### Deployment notes

- Publish `firestore.rules` after deployment. This is required for workspace membership reads/writes and per-workspace presence.
- No new Vercel environment variables are required.
- No new Storage rule changes are required for this build, but keep the bundled `storage.rules` current if your project is behind 14.x.

### Important behavior

- Existing single-restaurant employees keep working normally.
- Employees with two jobs should use one login and choose the correct workspace after login.
- Managers should add an employee's existing email to their roster when that employee already has an 86 Chaos login elsewhere.
- Linked existing accounts use their current password or the Forgot Password flow. A new temporary password is only shown for brand-new accounts.
