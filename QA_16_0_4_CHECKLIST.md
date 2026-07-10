# QA Checklist - 86 Chaos 16.0.4

## Main menu overlay

- Open the hamburger menu on desktop.
- Confirm the current page does not move, jump, or get pushed downward.
- Close the menu and confirm the page remains at the same scroll position.
- Repeat on mobile.
- Confirm the drawer appears over the page with the page dimmed behind it.

## Copper theme cleanup

- Confirm the main menu uses copper accents, not the previous bright action color.
- Confirm active menu items use the copper gradient.
- Confirm search focus, menu borders, and scrollbars use copper styling.
- Check Manager Brief, System Administrator, Inventory, Schedule, and Settings for obvious leftover bright action accents in the app shell.

## Main menu spacing

- Confirm sections show: Command, Kitchen Ops, Management, System.
- Confirm menu item spacing is tighter than 16.0.3.
- Confirm menu search still works for schedule, punch, inventory, recipe, help, system, and push.
- Confirm workspace switching still appears for accounts with multiple workspaces.

## Feature regression checks

- Manager Brief loads.
- Time Clock & Schedule loads.
- Schedule Builder still opens from Time Clock & Schedule.
- Financials still opens.
- Kitchen Command Center loads.
- Inventory and Menu Intelligence still load.
- Personal Reminders loads.
- Help Center loads.
- System Administrator keeps the recovered organized layout and search.
- Gemini Manual still works.
- Backup Center still lists backups.
- Health Checks route manifest loads and includes `/api/openai-diagnostics-explain`.

## 86 Voice safety

- Say or type: `86 chicken`.
- Confirm the app shows a confirmation card instead of sending immediately.
- Confirm the confirmation says inventory will not be changed.
- Confirm sending creates an 86 alert.
- Try a vague/bad item name and confirm the app does not silently map it to the wrong inventory item.

## OpenAI diagnostics explanation

- Add `OPENAI_API_KEY` to the Vercel environment and redeploy.
- Open System Administrator -> Health Dashboard.
- Run Full System Diagnostics.
- Click Explain with OpenAI.
- Confirm the answer includes severity, likely cause, go-to locations, ordered steps, verification, do-not-touch notes, deploy/publish notes, and escalation criteria.
- Confirm signed Storage URLs, bearer tokens, API keys, and private keys are not displayed.

## Checks run by builder

- API syntax check.
- React/JSX parse check.
- ZIP integrity check.
- Full build if dependencies are available.
