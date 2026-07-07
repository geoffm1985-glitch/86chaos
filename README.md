# 86 Chaos

Current version: 14.0.6

This build fixes System Administrator client-management saves that could fail when an old workspace record contained an unsupported empty/undefined value, and it removes the read-only notice banner from Staff Roster while keeping manager/admin-only editing protection in place.

See `README_14_0_6_RELEASE_NOTES.md` and `QA_14_0_6_CLIENT_SAVE_ROSTER_CLEANUP.md` for this build.

## Deployment notes

Deploy through GitHub/Vercel as usual. No new Vercel environment variables are required. No Firestore or Storage rule changes are required specifically for this fix, but keep the bundled 14.x rules published if your live Firebase project is behind.
