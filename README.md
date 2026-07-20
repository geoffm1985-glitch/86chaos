# 86 Chaos 15.0.81

## What changed in 15.0.81

This build fixes Python Ops Scan and Python Order Intelligence on Preview deployments where the browser is signed into the test Firebase project but the generic server `FIREBASE_SERVICE_ACCOUNT_KEY` belongs to production.

### Key fixes

- Login/auth remains eager-loaded and untouched.
- Python Ops and Python Order first try the full Firebase Admin authorization path.
- If a matching Admin credential is unavailable, those routes use a verified Firebase ID token and analyze the already-loaded client payload instead of failing with a service-account project mismatch.
- Server audit logging and server plan checks still run when full Admin credentials are available.
- Fallback mode is limited to client-loaded payload analysis and does not write audit logs.
- Recognized service-account aliases are expanded for test and production deployments.
- The restored Python runtime from 15.0.80 remains in place.
- The safe component and Inventory split from 15.0.79 remains in place.

### Deployment

Deploy with Vercel Clear Build Cache enabled. Do not change or paste Firebase service-account keys into the codebase.

See `README_15_0_81_RELEASE_NOTES.md` and `QA_15_0_81_PYTHON_OPS_CREDENTIAL_FALLBACK.md` before production rollout.
