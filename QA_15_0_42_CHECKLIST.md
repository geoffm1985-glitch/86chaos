# QA Checklist - 86 Chaos 15.0.42

## Gemini Manual completion
- [ ] Open System Administrator → Manual.
- [ ] Ask Gemini a longer troubleshooting question that previously cut off.
- [ ] Confirm the answer ends with a complete sentence.
- [ ] Confirm metadata shows model, API, duration, and finish reason.
- [ ] If Gemini auto-continued, confirm the metadata shows the auto-continuation count.
- [ ] Confirm the answer still follows the expected sections: What this probably means, Go here, Do this in order, How to know it worked, What not to touch yet, Deploy/publish separately, Escalate if.

## Continue button
- [ ] If an incomplete-answer warning appears, tap `Continue Gemini Answer`.
- [ ] Confirm the continued text appends to the existing answer instead of replacing it.
- [ ] Confirm `Copy Gemini Answer` copies the combined answer.
- [ ] Confirm the button is disabled while the continuation is loading.

## Security / redaction regression
- [ ] Ask a question while backup diagnostics are loaded.
- [ ] Confirm Gemini does not display signed backup URLs, bearer tokens, private keys, or raw API keys.
- [ ] Confirm a Super Admin is still required to call `/api/gemini-admin-manual`.

## Regression
- [ ] Confirm System Administrator loads without console errors.
- [ ] Confirm the reorganized System Administrator menu from 15.0.41 is still present.
- [ ] Confirm Health Checks still refresh.
- [ ] Confirm Backup Center still lists backups.
- [ ] Confirm Security Center still loads diagnostics.

## Build checks
- [ ] Confirm `/version.json` reports `15.0.42` after deploy.
- [ ] Confirm Vercel deploy succeeds.
