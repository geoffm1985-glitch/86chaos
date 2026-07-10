# 86 Chaos

Current Version: 15.0.49 - Monthly AI Page Limits and Invoice Noise Filtering

## Current build highlights

- Invoice AI scanning is limited by pages processed per workspace per calendar month: 40 invoice pages by default.
- Menu AI scanning is limited by pages processed per workspace per calendar month: 10 menu pages by default.
- PDF page counts are verified before AI is called; each image counts as one page.
- Page reservations use Firestore transactions and idempotency keys so simultaneous or duplicate submissions cannot double-count.
- Master Admin testing accounts configured through backend environment variables are logged but are not blocked by monthly page limits.
- System Administrator includes an AI Usage / Scan Limits view with workspace totals, failures, blocked scans, bypass pages, recent events, and Super Admin limit overrides.
- Invoice Scanner separates food/products, uncertain purchase rows, obvious non-food supplies, and document noise before review.
- Totals, tax, freight, addresses, contacts, payment rows, disposable supplies, cleaning products, PPE, and other obvious non-food rows no longer crowd the food review list.
- 15.0.48 product recovery, project-aware Firebase routing, dark professional System Administrator, retention jobs, Gemini completion guard, OpenAI diagnostics, and remembered alerts remain intact.

See `README_15_0_49_RELEASE_NOTES.md` and `QA_15_0_49_CHECKLIST.md`.
