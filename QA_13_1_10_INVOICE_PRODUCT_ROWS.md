# QA — 13.1.10 Invoice Product Row Filter

## Goal

Make sure the invoice scanner only imports products purchased and does not add document/admin text into inventory.

## Test

1. Deploy to staging.
2. Go to Inventory → Manage → Scan Invoice.
3. Upload the same invoice/PDF that previously showed email rows in Stock Matcher.
4. Wait for the review screen.
5. Confirm Stock Matcher only shows actual products purchased.
6. Confirm rows like these are not in Stock Matcher:
   - NoReply email addresses
   - From / To / Subject lines
   - Customer email addresses
   - Bill-to / ship-to text
   - Tax / subtotal / total rows
   - Freight / service fees / deposits
   - Footer or page text
7. Open Full Extraction Audit / Raw Text.
8. Confirm the scanner still kept raw invoice text/audit details.
9. Click Mark Unmatched as New.
10. Confirm only product rows are changed to Add as New Item.
11. Approve the invoice.
12. Confirm only product rows updated or created inventory items.

## Pass condition

The scanner may save non-product rows to invoice history/audit, but it must never show them as importable Stock Matcher rows and must never create inventory from them.
