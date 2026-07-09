# QA Checklist - 86 Chaos 15.0.29

## Version
- Confirm `/version.json` reports `15.0.29`.
- Confirm footer/app version shows `15.0.29`.

## Hamburger drawer search
- Open the hamburger menu.
- Type a search term.
- Close the menu.
- Reopen the menu and confirm the search field is empty.
- Navigate to a tab and reopen the menu again to confirm no stale search text appears.

## System Administrator explainers
- Open System Administrator.
- Click question marks on Platform, Health, Last Backup, Push Opt-In, and Next Automatic Backup.
- Confirm a help modal opens with plain-English guidance.
- Confirm clicking the question mark does not also navigate the card.

## Backup freshness
- Confirm Last Backup changes to warning styling when the last successful backup is older than roughly 30 hours.
- Confirm Next Automatic Backup displays extra guidance when the daily backup window was missed.
- On testing/preview, confirm the text tells you to use Run Backup Now and verify production cron separately.
- Run Backup Now and confirm backup status, document count, collection count, and integrity status refresh.

## Administrator Manual
- Open System Administrator → Administrator Manual.
- Search: `backup did not run`, `cron`, `MFA`, `permission denied`, `invoice scanner`, `drawer search`, `deployment failed`, and `restore drill`.
- Confirm each search returns useful troubleshooting steps.

## Regression
- Confirm AI Tools still opens.
- Confirm Account Security still opens.
- Confirm Security Center still opens.
- Confirm no Firestore/Storage rule publish is required.
