# 86 Chaos 15.0.42 Release Notes

## Gemini Manual Completion Guard

This release improves the Gemini-powered System Administrator Manual assistant so long answers are less likely to cut off before the final instructions.

### Changed
- Increased the server-side Gemini Manual max output budget.
- Added `finishReason`, `finishReasons`, `maxOutputTokens`, `autoContinuationCount`, `answerIncomplete`, `incompleteReason`, and `canContinue` metadata to `/api/gemini-admin-manual` responses.
- Added automatic continuation when Gemini returns `MAX_TOKENS` or the answer appears to end mid-sentence.
- Added a `Continue Gemini Answer` button in the System Administrator Manual panel for rare cases where Gemini still stops early.
- Updated the Gemini prompt rules to prioritize complete, concise answers over long unfinished answers.
- Preserved redaction rules for signed URLs, bearer tokens, API-key-shaped strings, and private keys.

### Deployment notes
- Redeploy on Vercel.
- No Firestore rules publish required.
- No Storage rules publish required.
- No new environment variables required.
- Optional: tune `GEMINI_MANUAL_MAX_OUTPUT_TOKENS` or `MANUAL_GEMINI_MAX_OUTPUT_TOKENS` if the assistant still needs more room.
