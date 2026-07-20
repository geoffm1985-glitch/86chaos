# QA Checklist: 15.0.82 Python Ops Fallback Fix

## Deploy

- Deploy to Vercel Preview with Clear Build Cache enabled.
- Confirm the exact Preview URL is allowed in Google Cloud API key website restrictions.
- Confirm the exact Preview URL is allowed in Firebase Auth authorized domains.

## Login

- Confirm login screen loads normally.
- Confirm Unlock System works on Preview.
- Confirm no lazy-login chunk error appears.

## Manager Brief Python Ops Scan

- Open Manager Brief / Today.
- Click Run Ops Scan once.
- Confirm the button does not require repeated clicks.
- Confirm the scan finishes with either a normal Python result or a safe fallback result.
- Confirm the UI does not show `[object Object]`.
- Confirm scan findings, if any, can be opened or reviewed.

## Vercel function behavior

- Confirm `/api/python-ops-intelligence` returns JSON.
- Confirm a Python engine failure returns an `ok: true` fallback payload instead of breaking the Manager Brief.
- Confirm readable error text is available in the API payload for diagnostics.

## Regression checks

- Confirm Inventory still lazy-loads behind auth.
- Confirm Recipes do not load on first app boot unless opened.
- Confirm Python Order Intelligence still loads from Inventory when available.
- Confirm Firebase service-account-key env vars were not renamed or removed.
