# 86 Chaos 13.1.10 — Invoice Product Row Filter

This build fixes the invoice scanner trying to place non-product document rows into the Stock Matcher.

## Changed

- Stock Matcher now receives only purchased/delivered product rows.
- Email headers, `From`, `To`, `Subject`, customer info, vendor contact info, addresses, totals, taxes, freight, fees, deposits, credits, payments, notes, page headers, and footers are saved to the invoice audit only.
- The AI prompt now explicitly separates `lineItems` from `allExtractedRows`.
- The API normalizer filters invoice rows again before returning data to the app.
- The browser filters rows again before opening the Reconcile Invoice screen.
- Approve & Update Stock has an additional guard so non-product rows cannot create inventory items or update stock.
- The review modal now shows Product Rows and Skipped Non-Stock counts.

## Test focus

Scan the same invoice that previously produced rows such as `NoReply@pfgc.com` or `To: ...`. Those rows should not appear in Stock Matcher anymore. They should be kept only in the Full Extraction Audit.
