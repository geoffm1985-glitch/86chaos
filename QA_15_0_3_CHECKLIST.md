# QA Checklist: 86 Chaos 15.0.3

## Deploy verification

- [ ] Deploy through GitHub/Vercel and confirm `/version.json` reports `15.0.3`.
- [ ] Confirm the app loads Inventory for the correct workspace after deploy.
- [ ] Confirm no new Firestore or Storage rule publish is required beyond whatever was already done for 15.0.2.

## Invoice notification cleanup

- [ ] Scan or use an existing invoice with multiple matched/new product rows.
- [ ] Approve the invoice from the Reconcile Invoice screen.
- [ ] Confirm only one final `Invoice Processed` notification appears.
- [ ] Confirm the final notification shows the total saved item count plus updated and added counts.
- [ ] Confirm there are no stacked `Saved / Invoice inventory item` notifications.
- [ ] Confirm newly created invoice inventory items still appear in Inventory.
- [ ] Confirm matched invoice rows still increase stock on existing inventory items.

## CSV import notification cleanup

- [ ] Import a CSV with multiple inventory rows.
- [ ] Confirm only one final `Upload Complete` notification appears.
- [ ] Confirm there are no stacked `Saved / CSV inventory item` notifications.
- [ ] Confirm imported inventory rows still appear in Inventory.

## Regression smoke test

- [ ] Add one manual inventory item and confirm the normal single-item confirmation still appears.
- [ ] Edit one inventory item and confirm the normal save flow still works.
- [ ] Confirm Inventory, Menu Intelligence, Prep, Today, and Team still load.
- [ ] Confirm demo mode does not expose real private customer/employee data.
- [ ] Confirm Help Center stays public-facing and does not expose System Administrator internals.
- [ ] Confirm Administrator Manual contains the 15.0.3 bulk notification cleanup guidance.
