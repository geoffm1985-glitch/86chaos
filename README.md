# 86 Chaos

Current version: 15.0.1

## Build: Invoice Scanner JSON Recovery

This build keeps the 15.0.0 Kitchen Intelligence work intact, then fixes the invoice scanner failure where Gemini could finish reading an invoice but return malformed or cut-off JSON at 100%.

See `README_15_0_1_RELEASE_NOTES.md` and `QA_15_0_1_CHECKLIST.md` for this build.

## Deploy notes

1. Deploy through GitHub/Vercel.
2. Confirm `/api/scan-invoice` is live after deploy.
3. Confirm `/version.json` reports `15.0.1` after deploy.
4. Re-test invoice scanning with the same invoice that previously showed `Gemini returned invalid JSON`.
5. Firestore rules and Storage rules are included unchanged from 15.0.0. Re-publish them only if the target Firebase project has not already received the 15.0.0 rules.

## Firebase/Vercel requirements

The existing Firebase Admin environment variables must remain set in Vercel:

- `FIREBASE_SERVICE_ACCOUNT_KEY` or the split Firebase Admin variables
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `MASTER_ADMIN_EMAIL`

AI scanning needs one of these Vercel variables:

- `GEMINI_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `GOOGLE_API_KEY`

Optional invoice scanner tuning variables, only if needed after this fix:

- `INVOICE_SCAN_TIMEOUT_MS` defaults to `285000`, which stays just under the Vercel 300-second function cap.
- `INVOICE_SCAN_MAX_OUTPUT_TOKENS` defaults to `65536`.
- `INVOICE_SCAN_COMPACT_MAX_OUTPUT_TOKENS` defaults to `32768`.
- `INVOICE_REPAIR_TIMEOUT_MS` defaults to `45000`.

Do not set the invoice function timeout above your Vercel plan's max function duration. If a huge PDF still struggles, split the invoice into smaller page groups instead of pushing the timeout past Vercel's ceiling.
