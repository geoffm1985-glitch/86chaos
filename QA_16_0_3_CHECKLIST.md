# QA Checklist - 86 Chaos 16.0.3

## Main menu

- Open the hamburger menu on desktop and mobile.
- Confirm sections show: Command, Kitchen Ops, Management, System.
- Confirm Manager Brief, Time Clock & Schedule, Financials, Kitchen Command Center, Message Board, Event Calendar, Prep & Tasks, Recipe Book, Inventory & Orders, AI Tools, Menu Intelligence, My Reminders, Staff Roster, Maintenance Log, System Administrator, System Audit, Help Center, and Settings appear only when allowed by the same permissions as before.
- Search the menu for schedule, punch, inventory, recipe, help, system, and push.
- Confirm workspace switching still appears for accounts with multiple workspaces.

## 86 Voice safety

- Say or type: `86 chicken`.
- Confirm the app shows a confirmation card instead of sending immediately.
- Confirm the confirmation says inventory will not be changed.
- Confirm sending creates an 86 alert in Manager Brief / Kitchen Command Center / Message Board.
- Say or type: `we're out of onions`.
- Confirm it creates an 86 alert path, not an inventory edit.
- Try a vague/bad item name and confirm the app does not silently map it to the wrong inventory item.

## System Administrator search

- Open System Administrator.
- Search: backup, cron, MFA, users, push, rules, Gemini, OpenAI, diagnostics.
- Confirm the left admin menu/tool map filters to relevant sections.
- Clear the search and confirm all System Administrator sections return.
- Confirm the System Administrator layout remains the organized 16.0.1 category layout, not the old dashboard-only layout.

## OpenAI diagnostics explanation

- Add `OPENAI_API_KEY` to the Vercel environment and redeploy.
- Open System Administrator -> Health Dashboard.
- Run Full System Diagnostics.
- Click Explain with OpenAI.
- Confirm the answer includes severity, likely cause, go-to locations, ordered steps, verification, do-not-touch notes, deploy/publish notes, and escalation criteria.
- Confirm signed Storage URLs, bearer tokens, API keys, and private keys are not displayed.

## Regression checks

- Manager Brief loads.
- Kitchen Command Center loads.
- Schedule Builder still opens from Time Clock & Schedule.
- Financials still opens.
- Inventory and Menu Intelligence still load.
- Gemini Manual still works.
- Backup Center still lists backups.
- Health Checks route manifest loads and includes `/api/openai-diagnostics-explain`.

## Checks run by builder

- API syntax check.
- React/JSX parse check.
- ZIP integrity check.
- Full build if dependencies are available.
