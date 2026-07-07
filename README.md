# 86 Chaos

Current version: 14.0.1

This build finishes the v14 kitchen hardening pass by wiring the Safe Write Engine into major kitchen operations, adding a recipe-to-inventory dependency graph editor, and letting Super Admins choose a backup snapshot from a picker before point-in-time preview/restore.

See `README_14_0_1_RELEASE_NOTES.md` and `QA_14_0_1_SAFE_WRITE_DEPENDENCY_RESTORE_PICKER.md` for this build.

## Deployment notes

Deploy through GitHub/Vercel as usual.

After deploying the app, publish the included `firestore.rules` to the matching Firebase project. The included `storage.rules` remains bundled for the existing logo/upload fallback rules. The Vercel API routes are included under `/api` and deploy with the app.
