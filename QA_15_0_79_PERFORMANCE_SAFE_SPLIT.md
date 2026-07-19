# QA Checklist: 15.0.79 Safe Component Split + Inventory Load Control

## Login safety

- Open the Vercel Preview URL in a fresh/incognito window.
- Confirm the login form appears immediately.
- Confirm a bad password shows a normal Firebase Auth error.
- Confirm a valid owner/admin account signs in.
- Confirm the app does not require clicking Unlock System more than once.
- Confirm no `auth/requests-from-referrer...blocked` error appears after the exact Preview URL is allowed in Google Cloud API key restrictions.

## Route chunk loading

- After login, open Today, then Inventory, then Recipes, then Schedule, then HR & Training.
- Confirm each route shows a short loading card if its chunk is still downloading.
- Confirm refreshing while already logged in lands on the same/default tab without a blank screen.

## Inventory performance

- Open Inventory Count and confirm it loads before invoices, burn logs, AI order, future events, or prep-order context are needed.
- Switch to Invoices and confirm invoice history/scanner loads there.
- Switch to Burn Log and confirm waste logs appear there.
- Switch to AI Order and confirm AI order recommendations, event checks, price warnings, and prep predictions load there.
- Search inventory and confirm the larger snapshot expands when needed.
- Use below-par focus from Today/Manager Brief and confirm Inventory opens Count and scrolls to the below-par area.

## Read/write sanity

- Watch Firebase usage or emulator logs while opening Today versus Inventory. Inventory should no longer create both shell and route inventory listeners at the same time.
- Confirm stock count updates still write once.
- Confirm invoice approval still writes invoice records and inventory changes.
- Confirm burn log entries still deduct stock and edits/restores still adjust stock correctly.

## Production guardrails

- Do not promote to production until Preview login, Inventory Count, Invoices, Burn Log, AI Order, Today, and Schedule have all passed with real test accounts.
- Deploy Preview once with Clear Build Cache enabled after this refactor.
