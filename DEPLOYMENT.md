# Deployment Checklist

1. Install dependencies with the generated lockfile.
2. Run `npm test` and `npm run rules:check`.
3. Run `CI=false npm run build`.
4. Run `npm --prefix functions ci` and `npm --prefix functions run build`.
5. Confirm Vercel environment variables are present, especially `FIREBASE_SERVICE_ACCOUNT_KEY`, `CRON_SECRET`, Firebase public config, and any AI keys used by scan routes.
6. Deploy the frontend/API to Vercel.
7. Deploy Firestore rules.
8. Deploy Storage rules.
9. Deploy Firebase Functions if using scheduled retention or callable/background jobs.
10. Complete `POST_REPAIR_QA.md` with safe test users before inviting more beta restaurants.
