# QA Checklist: 86 Chaos 15.0.1

## Deploy checks

- [ ] Deploy the ZIP through GitHub/Vercel.
- [ ] Confirm `/version.json` reports `15.0.1` after deploy.
- [ ] Confirm `/api/scan-invoice` is present in the Vercel deployment.
- [ ] Confirm Vercel has `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, or `GOOGLE_API_KEY`.
- [ ] Confirm Vercel still has the Firebase Admin variables needed for Storage download.

## Invoice scanner checks

- [ ] Re-scan the same invoice that previously failed with `Gemini returned invalid JSON`.
- [ ] Confirm the scan opens the Reconcile Invoice review screen instead of stopping at 100%.
- [ ] Confirm purchased product rows show in Stock Matcher.
- [ ] Confirm non-product rows like totals, tax, freight, customer info, and notes stay out of Stock Matcher and remain in the extraction audit.
- [ ] Scan a photo invoice and a PDF invoice if both are used in the restaurant.
- [ ] Check the scan metadata for scanner version `15.0.1` and note whether `scanAttempt` says `full-json` or `compact-json-retry`.

## Regression checks

- [ ] Confirm Menu Intelligence still scans menus.
- [ ] Confirm smart prep matching still updates existing prep rows instead of duplicating clear matches.
- [ ] Confirm My Reminders still creates private reminders.
- [ ] Confirm My Schedule and Full Schedule still gray out ended shifts.
- [ ] Confirm normal inventory add/edit, CSV import, and invoice approval still save through Safe Write Engine.
