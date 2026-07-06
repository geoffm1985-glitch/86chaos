# 86 Chaos 13.1.28 Release Notes

## Live presence reliability
- Added a dedicated `presenceSessions` heartbeat path in addition to the existing user-profile heartbeat.
- Staff Roster now prefers fresh session heartbeat data before falling back to older profile timestamps.
- System Administrator Live Activity and Recent Activity now merge live presence sessions into user activity so online users do not disappear behind stale `lastActive` values.

## Push test wording
- The System Administrator test push now sends a plain test notification.
- The test push message says it is only a test and does not describe a schedule as published.

## Security and permissions
- Regular staff can still view the roster read-only.
- Manager/admin users keep staff management tools.
- User heartbeat writes now include the `heartbeatEpochMs` safe field in Firestore rules so current activity is not rejected.

## Global lockdown bypass
- Global Lockdown now places every workspace into maintenance mode, including the owner's restaurant group.
- The platform Super Admin account bypasses the maintenance screen so it can still enter the app and lift the lockdown.
- Firestore rules now include a tenant-safe `presenceSessions` collection where users can write only their own presence session and tenant peers/admins can read live status.

## Deployment note
Publish the included `firestore.rules` to the Firebase project being used by the Vercel Preview deployment before testing live presence.
