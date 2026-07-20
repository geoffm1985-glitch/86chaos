# QA Checklist: 15.0.81 Python Ops Credential-Safe Fallback

## Deployment

- Deploy to Vercel Preview with Clear Build Cache enabled.
- Confirm `public/version.json` reports `15.0.81`.
- Confirm login still loads immediately and is not lazy-loaded.

## Python Ops Scan

- Sign into the Preview deployment.
- Open Manager Brief / Today where Python Ops Scan appears.
- Click Run Ops Scan once.
- Confirm the route no longer shows the old credential mismatch error.
- Confirm results render or a normal payload/data message appears.

## Python Order Intelligence

- Open Inventory / AI assisted ordering if enabled.
- Run the order intelligence action.
- Confirm it no longer fails only because `FIREBASE_SERVICE_ACCOUNT_KEY` contains the other Firebase project.

## Full Admin Mode

- In a deployment where matching Firebase Admin credentials exist for the active project, confirm audit logs are still written for Python Ops and Python Order runs.
- Confirm Smart Kitchen plan gating still applies when full Admin mode is available.

## Fallback Mode

- In Preview with only the production generic service account available, sign in with the test Firebase project.
- Run Python Ops Scan.
- Confirm the response may include `authMode: verified-token-payload-only` and a warning rather than blocking the scan.
- Confirm no server audit log is required in fallback mode.

## Regression Checks

- Login works.
- Inventory lazy loading still works.
- Main bundle split remains intact.
- Python engine routes `/api/python-ops-engine` and `/api/python-order-engine` return JSON on GET.
- No Firebase service-account key values are changed or committed.
