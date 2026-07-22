# 86 Chaos 15.1.12 Cron Credential Fix

This build is based on the working 15.1.9 Pixel + Production Lock app and only changes the Firebase Admin credential/cron failure path.

## Fixed
- Removed the old dispatch-reminders Firebase Admin setup error path.
- Removed the old hard failure wording that told deployments to split production/preview Firebase service account environment variables.
- Preserves the existing single service-account-key setup.
- Makes `/api/dispatch-reminders` return a safe skipped result instead of logging a production error when the serverless scope cannot see Admin credentials.
- Keeps real reminder dispatch working when the existing Firebase Admin credential is visible.

## Not Changed
- No Firebase rules were weakened.
- No new Vercel environment variables are required.
- No visual redesign changes were mixed into this emergency fix.
- The app remains on the 15.1.9 visual/functionality base, with version bumped to 15.1.12 for traceability.
