# QA Checklist - 86 Chaos 15.0.31

## Deployment
- Confirm Vercel build completes successfully.
- Confirm `/version.json` reports `15.0.31`.
- Confirm the app loads to the login screen or dashboard without a blank screen.

## System Administrator
- Log in with a Super Admin account and open System Administrator.
- Confirm Admin Access diagnostics render.
- Confirm question-mark helpers open explanations on signal cards.
- Confirm the footer/version label shows `15.0.31`.

## Regression
- Open and close the hamburger menu and confirm stale search text clears.
- Open Backup/Security Center and confirm stale backup warnings still display.
- Confirm normal non-admin navigation still loads.
