# 86 Chaos

Current version: 14.0.7

This build fixes the multi-workspace picker so an employee/account that belongs to more than one restaurant is discovered through a server-side membership lookup, not just browser Firestore queries. The login picker should appear for multi-restaurant accounts, and remembered sessions now refresh memberships and show the header switcher.

See `README_14_0_7_RELEASE_NOTES.md` and `QA_14_0_7_WORKSPACE_PICKER_RELIABILITY.md` for this build.

## Deployment notes

Deploy through GitHub/Vercel as usual. This build adds one Vercel API route: `/api/workspace-memberships`. No new environment variables are required if the existing Firebase Admin credentials are already configured. No Firestore or Storage rule changes are required specifically for this fix.
