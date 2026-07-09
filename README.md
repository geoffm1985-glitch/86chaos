# 86 Chaos

Current Version: 15.0.42 - Gemini Manual Completion Guard

## 15.0.42 focus

This release fixes the System Administrator Manual assistant issue where Gemini answers could stop mid-sentence on longer troubleshooting responses.

### Included fixes
- Increased the Gemini Manual assistant output budget on the server route.
- Added Gemini finish-reason tracking so `MAX_TOKENS` cutoffs are visible in the UI.
- Added server-side incomplete-answer detection for dangling endings such as answers ending with “if”, “because”, commas, or unfinished section headers.
- Added automatic continuation attempts so the server asks Gemini to finish the answer before returning it to the app.
- Added a `Continue Gemini Answer` button when Gemini still appears incomplete after automatic retries.
- Updated Gemini instructions so it favors shorter complete instructions over long answers that cut off.
- Added response metadata in the Manual panel showing finish reason and auto-continuation count.
- Updated Administrator Manual release documentation for the Gemini completion guard.

### Separate deployment / publishing
- Vercel redeploy required because frontend code, `/api/gemini-admin-manual`, and version metadata changed.
- No `vercel.json` changes.
- No Firestore rules changes.
- No Storage rules changes.
- No new env vars required.
- Optional tuning env var: `GEMINI_MANUAL_MAX_OUTPUT_TOKENS` or `MANUAL_GEMINI_MAX_OUTPUT_TOKENS`. Default is `4096`, capped at `8192`.

### Quick validation
1. Deploy to Vercel preview/testing first.
2. Confirm `/version.json` reports `15.0.42`.
3. Open System Administrator → Manual.
4. Ask a longer Gemini question, such as “Users schedule has disappeared and backup is stale, what do I check?”
5. Confirm the answer does not stop mid-sentence.
6. Confirm metadata shows model, API, duration, finish reason, and auto-continuation count when used.
7. If a warning appears, tap `Continue Gemini Answer` and confirm the answer appends instead of replacing the existing response.

## Notes
- 86 Chaos branding remains mandatory and cannot be hidden or replaced.
- Customer restaurant logos may appear beside 86 Chaos branding, but not instead of it.
- Keep Help Center public-facing and generic. Keep System Administrator security details inside the Administrator Manual.
