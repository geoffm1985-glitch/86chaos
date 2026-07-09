# QA Checklist - 86 Chaos 15.0.35

## Deployment
- Confirm `/version.json` reports `15.0.35`.
- Confirm the app loads without a blank screen.
- Confirm System Administrator opens for configured Super Admin accounts.

## System Administrator layout
- On desktop, confirm section buttons are on the left side, not across the top.
- On desktop, click each left-menu group item and confirm the right-side content changes.
- Confirm the Command Deck / information board appears at the top above the left-menu/content area.
- Click Hide Info Board, then Show Info Board, and confirm it collapses/reopens cleanly.

## Mobile layout
- On a phone-width screen, confirm the Admin Menu is collapsed by default.
- Tap Menu, choose a System Administrator section, and confirm the menu closes after selection.
- Confirm the Info Board can still be opened and hidden on mobile.
- Confirm no horizontal scrolling is introduced by the left-menu layout.

## Regression checks
- Run Master Admin Self-Repair from Overview if needed.
- Open Health Dashboard and run health checks.
- Open Administrator Manual and search `15.0.35`, `left menu`, and `info board`.
- Confirm the existing question-mark help buttons still open descriptions.
