# 86 Chaos 15.0.49 Release Notes

## Monthly AI page limits

AI invoice and menu scanning now use monthly page allowances per restaurant/workspace instead of scan-count allowances.

Default limits:

- Invoice Scanner: 40 AI-processed pages per month
- Menu Intelligence: 10 AI-processed pages per month

PDFs are counted by their verified page count before the AI provider is called. Images count as one page each. The shared page counter also supports multiple uploaded images by totaling one page per image.

## Server-side enforcement

- Page limits are enforced inside `/api/scan-invoice` and `/api/scan-menu`.
- Firestore transactions reserve pages before an AI request, preventing simultaneous scans from overspending the remaining allowance.
- Per-user idempotency keys prevent duplicate clicks or request retries from double-counting pages.
- Upload, file validation, and PDF page-count failures that happen before an AI provider call do not consume pages.
- Requests that reach the AI provider remain counted even when the AI call or response processing fails.
- Blocked scans are logged without consuming pages.
- Usage event errors redact bearer tokens, API keys, private keys, and Firebase Storage URLs.

## Master Admin testing bypass

A user whose verified Firebase token email matches `MASTER_ADMIN_EMAIL` or an address in `MASTER_ADMIN_EMAILS` can scan beyond the monthly allowance for testing.

The bypass:

- is decided only on the backend;
- does not trust `REACT_APP_MASTER_ADMIN_EMAIL`;
- can also use a trusted `aiScanLimitBypass`, `masterAdmin`, or `isMasterAdmin` custom claim;
- logs all processed pages;
- sets `limitBypass: true` and `bypassReason: "master_admin_testing"`;
- records whether the scan would have exceeded the normal workspace limit;
- does not expose a bypass control to customers.

## Usage records

Monthly totals are stored at:

`aiUsage/{restaurantId}_{YYYY-MM}`

Individual events are stored at:

`aiUsage/{restaurantId}_{YYYY-MM}/events/{eventId}`

The records include page totals, limits, scan counts, status, provider/model, idempotency key, bypass details, before/after usage, errors, and available token estimates.

## Scanner usage displays

Invoice Scanner and Menu Intelligence now show monthly usage, remaining-page warnings, reached-limit explanations, and a small testing-bypass note for the verified exempt account. Submission controls are disabled when a normal workspace reaches its allowance.

## System Administrator

A new **AI Usage / Scan Limits** section shows:

- every restaurant/workspace, including workspaces with no usage yet;
- invoice pages used and limit;
- menu pages used and limit;
- scans submitted;
- testing-bypass pages;
- failed and blocked events;
- provider and model details;
- recent scan events;
- Super Admin-only monthly limit overrides.

## Cleaner invoice review

Invoice classification now separates rows into:

- Food/Product for Stock Matcher
- Needs Review for genuinely uncertain purchased rows
- Non-food for obvious supplies
- Document rows retained only in the extraction audit

Taxes, totals, freight, credits, payments, addresses, contacts, headers, cleaning chemicals, disposable packaging, paper goods, PPE, janitorial tools, common smallwares, and obvious facility supplies no longer crowd the food review queue. A manager can still move a filtered non-food item into Stock Matcher when the restaurant intentionally tracks it.

Dense distributor food rows remain recoverable even when AI labels them as notes, headers, or metadata.

## Security and deployment

- Browser clients are explicitly denied direct access to `aiUsage` documents and event subcollections.
- The generic Firestore fallback rule also excludes `aiUsage` and retention lock documents.
- Publish the included `firestore.rules` to testing and production.
- Preview requires `FIREBASE_TEST_SERVICE_ACCOUNT_KEY` because page reservations are server-side Firestore transactions.
- Production requires the matching production Firebase Admin credential.
- Ensure `MASTER_ADMIN_EMAIL` and/or `MASTER_ADMIN_EMAILS` are configured in both Vercel environments where the testing bypass is needed.
- No Storage rules, Firestore indexes, Firebase Functions, or Vercel configuration changes are required.
