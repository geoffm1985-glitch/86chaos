# QA 13.1.8 - Invoice Scanner Progress

## Basic scan

- [ ] Open Inventory → Invoices.
- [ ] Upload a clear invoice photo.
- [ ] Confirm no spinning loader appears.
- [ ] Confirm progress bar appears.
- [ ] Confirm upload percentage increases.
- [ ] Confirm AI scanner status appears after upload finishes.
- [ ] Confirm Reconcile Invoice modal opens.
- [ ] Confirm Approve & Update Stock saves invoice to history.

## PDF scan

- [ ] Upload a normal invoice PDF.
- [ ] Confirm upload progress shows actual MB uploaded/total MB.
- [ ] Confirm scan completes or shows a clear error.

## Error/timeout

- [ ] Test a very large/poor-quality invoice in staging.
- [ ] Confirm it does not spin forever.
- [ ] Confirm it shows a clear timeout or file-size message.
- [ ] Confirm scanner controls become usable again after an error.

## Regression

- [ ] CSV import still works.
- [ ] Inventory count/edit still works.
- [ ] Invoice history still sorts newest first.
- [ ] Help Center search for “invoice scanner progress” finds the updated article.
