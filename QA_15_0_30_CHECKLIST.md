# QA Checklist - 86 Chaos 15.0.30

## Version
- Confirm `/version.json` reports `15.0.30`.
- Confirm footer/app version shows `15.0.30`.
- Confirm System Administrator runtime panel shows `15.0.30`.

## System Administrator access rescue
- In Preview Vercel env vars, confirm the intended admin email is included in `MASTER_ADMIN_EMAIL` or `MASTER_ADMIN_EMAILS`.
- Confirm `REACT_APP_MASTER_ADMIN_EMAIL` is set for frontend menu visibility if needed.
- Redeploy the testing branch after env var edits.
- Log in with `geoffm1985@gmail.com` or the intended admin account.
- Confirm System Administrator appears in the menu after `/api/whoami` refreshes.
- If access is denied, open `?tab=godmode` and confirm the lockout screen explains email, UID, server check, env status, custom claim, and Firestore flag.

## Admin Access diagnostic
- Open System Administrator.
- Confirm the dashboard contains an **Admin Access** signal card.
- Click its question mark and confirm it explains env vars, custom claims, and Firestore flags.
- Open Security/diagnostics area and confirm Access Model shows frontend master env, server master env, and access source.

## Question-mark helpers from 15.0.29
- Click question marks on Platform, Health, Admin Access, Last Backup, Push Opt-In, and API Routes.
- Confirm a help modal opens with plain-English guidance.
- Confirm clicking the question mark does not also navigate the card.

## Hamburger drawer search
- Open the hamburger menu.
- Type a search term.
- Close the menu.
- Reopen the menu and confirm the search field is empty.

## Backup troubleshooting
- Confirm Last Backup warns when older than roughly 30 hours.
- Confirm preview/testing text explains Vercel Cron does not auto-fire on preview deployments.
- Use Run Backup Now in testing and confirm backup status refreshes.

## Regression
- Confirm Account Security opens.
- Confirm MFA recovery tools still load.
- Confirm AI Tools still opens.
- Confirm Security Center still opens.
- Confirm no Firestore/Storage rule publish is required.
