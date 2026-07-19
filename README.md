# 86 Chaos 15.0.80

## What changed in 15.0.80

This build restores the Python Ops/Python Order Intelligence runtime that was referenced by the app UI but missing from the 15.0.79 safe split package.

### Restored Python Intelligence routes

- `/api/python-ops-intelligence` Node authenticated wrapper
- `/api/python-order-intelligence` Node authenticated wrapper
- `/api/python-automation-run` scheduled/manual automation wrapper
- `/api/python-ops-engine.py` Vercel Python function
- `/api/python-order-engine.py` Vercel Python function
- `api/_python-function-client.js` internal route client
- `scripts/python/ops_intelligence.py`
- `scripts/python/order_intelligence.py`
- root `requirements.txt` so Vercel packages Python functions cleanly

### Preserved from 15.0.79

- Login/Auth stays eager-loaded.
- Heavy authenticated tabs remain lazy-loaded only after login.
- Inventory stays in its own feature chunk.
- Inventory sub-data still loads on demand by sub-tab.
- Audit/security repairs from 15.0.78 remain in place.

### Deployment note

Use Vercel **Clear Build Cache** for the next Preview deploy so the restored Python functions are packaged from a clean cache.

See `README_15_0_80_RELEASE_NOTES.md` and `QA_15_0_80_PYTHON_OPS_RESTORE.md` before production rollout.
