# 86 Chaos 13.1.27 Release Notes

## Staff Roster Permissions & Activity

- Staff Roster now stays visible for regular staff as a read-only roster.
- Add, edit, reset-password, and remove controls are only shown to manager/admin accounts.
- Voice/menu navigation can open Staff Roster for regular staff without exposing edit controls.
- Last active status in Staff Roster now checks all available presence fields: `lastHeartbeatAt`, `presenceUpdatedAt`, `lastActive`, and `lastSeen`.
- Last active display now shows clearer labels such as Online now, 15m ago, Yesterday, or Never active.

## Deployment Notes

- No API route changes.
- No Vercel environment variable changes.
- No Storage rules changes.
- No Firestore rules publish is required for this release because backend user writes were already restricted to admin-level accounts in the reverted 13.1.22 baseline.
