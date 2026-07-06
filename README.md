# 86 Chaos

Current build: 13.1.10

## 13.1.10 focus

Invoice scanner cleanup:

- Stock Matcher now shows only purchased product rows.
- Email headers, From/To lines, addresses, customer info, terms, taxes, totals, freight, fees, deposits, discounts, payments, credits, notes, and footer/header rows stay in the Full Extraction Audit only.
- Approve & Update Stock now has a second safety guard so non-product rows cannot update stock or be added as new inventory items.
- The large-document scanner path, Firebase upload progress bar, and longer invoice timeout from 13.1.9 remain in place.

Deploy to staging first, scan a real invoice, confirm only purchased products appear in Stock Matcher, then approve.
