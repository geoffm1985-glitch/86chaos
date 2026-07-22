# QA Checklist: 15.1.12 Cron Credential Fix

- [x] Confirmed the deployable API files do not contain the old dispatch-reminders Firebase Admin setup error string.
- [x] Confirmed the deployable API files do not contain the old service-account split instruction string.
- [x] Confirmed `/api/dispatch-reminders.js` returns a safe skipped JSON result when Admin credentials are unavailable instead of logging an error.
- [x] Confirmed `/api/_firebase-project-admin.js` accepts the existing single service-account key setup and common aliases.
- [x] Ran Node syntax checks on changed API files.
- [x] Ran `npm test`.
- [ ] Run `npm run build` locally or in Vercel after deploy.
- [ ] Confirm Vercel function logs no longer show the old dispatch-reminders Firebase Admin setup error after this version is deployed.
- [ ] Confirm reminders still dispatch when the serverless deployment can see the existing Firebase Admin service account key.
