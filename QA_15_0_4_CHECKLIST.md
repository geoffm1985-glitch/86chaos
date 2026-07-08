# QA Checklist: 86 Chaos 15.0.4

## Deploy verification

- [ ] Deploy through GitHub/Vercel and confirm `/version.json` reports `15.0.4`.
- [ ] Confirm Menu Intelligence loads for a user with Menu Intelligence access.
- [ ] Confirm no new Firestore or Storage rule publish is required beyond the rules already deployed for 15.0.2/15.0.3.

## Scan Menu progress bar

- [ ] Select a menu image or PDF under 20MB.
- [ ] Click Scan Menu.
- [ ] Confirm the old spinner is replaced by a progress bar.
- [ ] Confirm the upload stage shows percent, status text, and elapsed time.
- [ ] Confirm the AI-reading stage shows status text and elapsed time while waiting for the scan result.
- [ ] Confirm the review modal opens after a successful scan.
- [ ] Confirm an over-20MB menu file is blocked with the existing clear too-large message.

## Approve Reviewed Menu Links protection

- [ ] Review a menu scan with multiple ingredient matches.
- [ ] Click Approve Reviewed Menu Links once.
- [ ] Confirm the button disables while saving.
- [ ] Try clicking again rapidly and confirm duplicate saves are not created.
- [ ] Confirm the approval progress bar shows saved-link progress and elapsed time.
- [ ] Confirm one final Menu Intelligence Saved notification appears.
- [ ] Confirm the recent scan summary appears once.

## Edit approved menu scans

- [ ] In Recent Menu Scans, click the edit button on an approved scan.
- [ ] Rename the scan and save.
- [ ] Edit a menu item name/category/description and save.
- [ ] Change an ingredient inventory match and save.
- [ ] Add a new ingredient link and save.
- [ ] Remove an ingredient link and save.
- [ ] Confirm Current Menu Impacts reflects the edited links when the linked inventory item is zero-stock.

## Delete approved menu scans

- [ ] Delete a recent menu scan.
- [ ] Confirm the confirmation message shows the number of linked ingredients being removed.
- [ ] Confirm the scan summary disappears from Recent Menu Scans.
- [ ] Confirm the linked menu-impact dependencies for that scan are removed.
- [ ] Confirm unrelated menu scans and dependencies remain intact.

## Regression smoke test

- [ ] Confirm Inventory still loads and single-item inventory saves still work.
- [ ] Confirm invoice approval still shows one summary notification from 15.0.3.
- [ ] Confirm Menu Intelligence remains permission controlled.
- [ ] Confirm demo mode does not expose real private customer/employee data.
- [ ] Confirm Help Center stays public-facing and does not expose System Administrator internals.
- [ ] Confirm Administrator Manual contains the 15.0.4 Menu Intelligence guidance.
