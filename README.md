# 86 Chaos

Current version: 14.0.0

This build adds the 14.0 Robustness Suite while preserving the existing React/Firebase/Vercel structure.

See `README_14_0_0_RELEASE_NOTES.md` and `QA_14_0_0_ROBUSTNESS_SUITE.md` for this build.

## Deployment notes

Deploy through GitHub/Vercel as usual.

After deploying the app, publish the included `firestore.rules` and `storage.rules` to the matching Firebase project. The new Vercel API routes are included under `/api` and deploy with the app.
