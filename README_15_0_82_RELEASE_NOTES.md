# 86 Chaos 15.0.82 Release Notes

## Python Ops Scan fallback fix

This release fixes the Manager Brief Python Ops Scan failure that could display `[object Object]` after the Python runtime wrapper returned a structured error object.

### Fixed

- Python Ops Scan no longer fails the Manager Brief when the Vercel Python function returns an object-shaped error.
- `/api/python-ops-intelligence` now runs the Python engine first, then falls back to a safe Node payload-based Ops Scan if the Python runtime is unavailable.
- Error handling now converts object-shaped API errors into readable messages instead of `[object Object]`.
- Manager Brief and Inventory Python Ops UI now use readable API error formatting.
- Login/auth remains eager-loaded and unchanged from the safe line.
- Service-account-key handling remains untouched.

### Kept from previous safe releases

- Audit security repairs from 15.0.78.
- Auth/login diagnostics and button lock from 15.0.77.
- Safe component split and Inventory loading improvements from 15.0.79.
- Python Ops route restoration from 15.0.80.
- Verified-token payload mode from 15.0.81.
