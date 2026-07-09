# QA Checklist - 86 Chaos 15.0.33

## Deployment
- Confirm Vercel build completes successfully.
- Confirm `/version.json` reports `15.0.33`.
- Confirm the app loads to the login screen or dashboard without a blank screen.

## System Administrator Manual
- Log in as a System Administrator.
- Open System Administrator -> Manual.
- Type: `Only I receive push notifications`.
- Confirm the support console renders likely cause, first checks, fix steps, warnings, and relevant articles.
- Click a relevant article and confirm it opens inside the article panel.
- Click Copy Support Answer and confirm text copies.

## Regression checks preserved from 15.0.32
- Open System Administrator -> Security Center.
- Confirm account deletion request review controls still render.
- Confirm Account Security still shows recovery-code messaging.
- Confirm backups, restore drill status, push diagnostics, menu scan, invoice scan, and admin access diagnostics still open.

## Production Gate
- Deploy to testing first.
- Do not publish hardened Firebase rules unless a real Super Admin claim/profile flag exists.
- Do not turn on MFA enforcement until MFA enrollment and recovery are tested.
