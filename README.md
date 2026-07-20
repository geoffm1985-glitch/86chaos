# 86 Chaos 15.0.82

## What changed in 15.0.82

This release fixes the Python Ops Scan failure that could show `[object Object]` in Manager Brief.

- Keeps login/auth eager-loaded and untouched.
- Keeps service-account-key handling untouched.
- Runs the Python Ops engine first when available.
- Falls back to a safe payload-based Ops Scan when the Python runtime returns a structured error or fails.
- Converts object-shaped API errors into readable diagnostics.
- Keeps the audit repairs, safe component split, and Inventory lazy-loading work from the prior safe releases.

See `README_15_0_82_RELEASE_NOTES.md` and `QA_15_0_82_PYTHON_OPS_FALLBACK_FIX.md` before production rollout.
