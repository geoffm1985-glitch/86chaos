# 86 Chaos 15.0.81 Release Notes

## Python Ops Credential-Safe Fallback

This release fixes the Python Ops Scan and Python Order Intelligence routes on Preview deployments where the signed-in browser Firebase project does not match the generic server `FIREBASE_SERVICE_ACCOUNT_KEY` project.

### What changed

- Keeps login/auth eager-loaded and untouched.
- Keeps the 15.0.79 safe component and Inventory split.
- Keeps the 15.0.80 restored Python Ops/Python Order runtime files.
- Adds `api/_python-auth-fallback.js` for Python payload routes.
- Python Ops and Python Order now first try the full Firebase Admin authorization path.
- If the active Preview token belongs to a trusted Firebase project but the matching Admin credential is missing or mismatched, the route falls back to verified-token payload-only mode.
- In fallback mode, the scan analyzes the already-loaded app payload and does not attempt Firestore reads, plan lookups, App Check verification, or audit-log writes.
- Expands recognized test/production service-account environment variable aliases so existing Vercel credential names are less likely to be ignored.

### Why

The app was showing a Python Ops failure similar to:

`No server credential is configured for Firebase project chaos-test-d1601. FIREBASE_SERVICE_ACCOUNT_KEY currently contains project_id cheers-34b8d.`

That blocked the scan even though the browser had already loaded the operational data needed for the Python analysis. This release prevents the scan from failing only because Preview is signed into the test Firebase project while the generic server credential points to production.

### Important note

Full Firebase Admin mode is still preferred because it allows server-side permission checks, plan checks, App Check verification, and audit logging. Fallback mode is intentionally limited to analyzing the client-loaded payload and returning results.

