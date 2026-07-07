# 86 Chaos 14.0.7 Release Notes

## Workspace Picker Reliability

- Added `/api/workspace-memberships` so multi-workspace accounts are discovered using Firebase Admin instead of relying only on browser Firestore membership queries.
- Login now merges server-discovered memberships, user profile memberships, legacy restaurant fields, and workspaceMembers records.
- Remembered sessions now refresh memberships after the app opens, so the header Switch Workspace button appears even if the user was already cached from an older build.
- Multi-restaurant accounts are prompted with the workspace picker once per app session.
- Existing single-restaurant accounts continue straight into their workspace.

## Why this matters

Employees can work at two restaurants using one login. Their schedule, punch, role, wage, permissions, presence, and notifications remain tied to the selected restaurant instead of bleeding across workspaces.

## Deploy notes

- Deploy the app to Vercel so `/api/workspace-memberships` is live.
- No new Vercel environment variables are required.
- No Firestore or Storage rule publish is required for this specific fix.
