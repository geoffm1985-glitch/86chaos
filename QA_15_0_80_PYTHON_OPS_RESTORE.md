# QA Checklist: 15.0.80 Python Ops Restore

## Deploy

- Deploy to Vercel Preview with **Clear Build Cache** enabled.
- Confirm Preview build logs include Python function packaging for `python-ops-engine.py` and `python-order-engine.py`.
- Confirm `CRON_SECRET` or `PYTHON_INTERNAL_SECRET` exists in Vercel environment variables.

## Login safety

- Open Preview in a fresh/incognito browser.
- Login successfully.
- Confirm the login screen appears immediately and does not lazy-load behind a suspense fallback.

## Manager Brief Python Ops Scan

- Open Manager Brief/Today.
- Click **Run Ops Scan**.
- Expected: either a successful Python Ops report or a specific environment/permission/plan error.
- Not expected: generic `Python Ops Intelligence failed.`

## Inventory Python Order Intelligence

- Open Inventory.
- Open the AI/order intelligence area.
- Run AI order intelligence.
- Expected: report data or a specific environment/permission/plan error.

## System Administrator Python Automation Center

- Open System Administrator as Super Admin.
- Run the manual Python automation action.
- Expected: completed automation summary or a specific missing-secret error.

## Regression checks

- Inventory still loads without pulling invoices/burn logs/AI data until needed.
- Daily reminders dispatch route still works.
- Push/send routes still compile.
- Health Checks include Python routes as available.
