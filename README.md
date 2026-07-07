# 86 Chaos

Current version: 14.0.4

This build adds the full multi-workspace switcher so one Firebase login can belong to more than one restaurant. Employees with multiple jobs can choose the active workspace after login, switch from the app header, and keep schedules, punches, roles, wages, permissions, and presence separated by restaurant.

See `README_14_0_4_RELEASE_NOTES.md` and `QA_14_0_4_MULTI_WORKSPACE_SWITCHER.md` for this build.

## Deployment notes

Deploy through GitHub/Vercel as usual.

After deploying the app, publish the included `firestore.rules` to the matching Firebase project. The multi-workspace membership model, Staff Roster linking, workspace reads, and per-workspace presence depend on the updated Firestore rules. No new Vercel environment variables are required. No new Storage rule changes are required for this build, but keep the bundled `storage.rules` published if your Firebase project is behind the 14.x logo/upload rules.
