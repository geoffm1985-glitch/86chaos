# Environment Variables

Required for production/server API routes:

- `FIREBASE_SERVICE_ACCOUNT_KEY`: full service-account JSON for the active Firebase project. This remains the primary supported service-account path.
- `CRON_SECRET`: bearer or `x-cron-secret` value required by `/api/dispatch-reminders`.
- Firebase public web config values used by the React app.
- AI provider keys used by invoice/menu/recipe scan routes, when enabled.

Recommended production hardening:

- `APP_CHECK_ENFORCE=true`
- `MFA_ENFORCE_ELEVATED_ROLES=true`
- Route-specific rate limit environment variables when higher/lower limits are needed.
