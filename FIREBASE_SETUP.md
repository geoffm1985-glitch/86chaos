# Firebase Setup

Deploy these with the 15.0.91 app build:

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

Recommended Firebase Console settings:

- Enable App Check for the web app and enforce it for production after verifying tokens flow to protected routes.
- Enable multi-factor authentication for elevated accounts.
- Keep separate testing and production Firebase projects.
- Use safe test users or emulator seed data before manual QA.

The application expects tenant documents to include subscription/entitlement metadata. Existing workspaces without modern subscription fields should be backfilled to Founder Beta Smart Kitchen or intentionally assigned by the System Administrator.
