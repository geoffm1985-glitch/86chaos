# 86 Chaos 15.0.80 Release Notes

## Purpose

Fixes the Manager Brief/Inventory Python Ops Scan failure introduced during the safe split package by restoring the missing Python Intelligence API and Vercel Python function files.

## Fixed

- Restored `/api/python-ops-intelligence` used by Manager Brief Python Ops Scan.
- Restored `/api/python-order-intelligence` used by Inventory AI ordering intelligence.
- Restored `/api/python-automation-run` used by System Administrator Python Automation Center and scheduled ops intelligence.
- Restored `/api/python-ops-engine.py` and `/api/python-order-engine.py`.
- Restored the internal Python function client and standard-library Python analysis scripts.
- Added root `requirements.txt` so Vercel recognizes/packages the Python runtime cleanly.
- Added Vercel function configuration and cron entry for Python Automation Run.

## Not changed

- Login/Auth loading path was not changed.
- Firebase service account key handling was not changed.
- The 15.0.79 safe component split remains intact.
- Inventory on-demand sub-tab loading remains intact.

## Required environment

The internal Python wrappers require `CRON_SECRET` or `PYTHON_INTERNAL_SECRET` in Vercel. Existing reminder/cron deployments normally already have `CRON_SECRET`; no new secret is required if it is already set.
