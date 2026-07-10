# 86 Chaos

Current Version: 15.0.48 - Invoice Product Row Recovery

## Current build highlights

- Invoice Scanner recovers dense distributor product rows from both `lineItems` and the full extraction audit.
- Valid purchase rows are recognized from quantity, UOM, pack size, SKU, description, and price signals even when AI labels the row type incorrectly.
- Obvious document rows such as totals, taxes, freight, addresses, payment details, and headers stay out of inventory.
- The former Skipped Rows panel is now Needs Review and includes a manual Move to Stock Matcher safety control.
- Approve & Update Stock is blocked until every purchased product row is matched to inventory or explicitly marked Add as New Item.
- Project-aware Firebase routing and the dark, compact System Administrator console from 15.0.47 remain intact.
- Automated retention, Gemini Manual continuation, OpenAI diagnostics, remembered alerts, legal/privacy disclosures, and mandatory 86 Chaos branding remain intact.

See `README_15_0_48_RELEASE_NOTES.md` and `QA_15_0_48_CHECKLIST.md`.
