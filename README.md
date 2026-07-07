# 86 Chaos

Current version: 14.0.2

This build fixes mandatory tip declaration so it is treated as a core Time Clock & Schedule feature for every workspace, even when older restaurant settings are missing the `tips` field.

See `README_14_0_2_RELEASE_NOTES.md` and `QA_14_0_2_TIP_DECLARATION_RELIABILITY.md` for this build.

## Deployment notes

Deploy through GitHub/Vercel as usual.

After deploying the app, publish the included `firestore.rules` to the matching Firebase project if your live rules are behind 14.x. The included `storage.rules` remains bundled for the existing logo/upload fallback rules. The Vercel API routes are included under `/api` and deploy with the app.
