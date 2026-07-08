# 86 Chaos 15.0.1 Release Notes

## Invoice Scanner JSON Recovery

- Fixed the invoice scanner path that could stop at 100% with `Gemini returned invalid JSON`.
- Added stronger Gemini JSON cleanup for code fences, leading text, trailing commas, invalid primitives, unquoted keys, control characters, smart quotes, and cut-off JSON endings.
- Added a compact retry prompt for invoices where the first AI response is too large or likely truncated.
- Added an AI JSON repair pass before the scan gives up, so near-valid Gemini responses can still open the Reconcile Invoice review screen.
- Added invoice model fallback support using `INVOICE_SCAN_GEMINI_MODEL`, `GEMINI_INVOICE_MODEL`, `GEMINI_MODEL`, then newer Flash fallbacks.
- Added support for `GOOGLE_GENERATIVE_AI_API_KEY` on the invoice scanner to match Menu Intelligence.
- Kept the Vercel function max duration at 300 seconds and the scanner timeout below that cap. The screenshot error looked like malformed/truncated JSON, not a browser timeout.
- Updated README, QA checklist, Help Center release note, Administrator Manual, package version, public version file, and the release guardrail to 15.0.1.

## Important behavior

No Firestore rules, Storage rules, Vercel config, or new API routes were required for this fix. Deploying the updated app code publishes the corrected `/api/scan-invoice` route.
