# 86Voice Confirmation and Blocked Commands — 15.0.61

## Can run immediately when confident and allowed

- Navigate to an allowed screen.
- Search Help Center.
- Search/open a recipe.
- Add or update a simple prep item with a high-confidence match.
- Mark a prep item done with a high-confidence match.
- Create a private reminder with a clear date/time.
- Answer “what needs done?” or “what are we out of?” using only data the user can already access.

## Requires confirmation or review

- Multiple possible prep matches.
- Multiple possible task matches.
- Shared reminders.
- Ambiguous teammate names.
- 86 alerts.
- Low-confidence item matches.
- Inventory burn/waste commands.
- Message Board posts.
- Maintenance issue creation.
- Any action that could affect other people or public workspace communication.

## Intentionally blocked from voice auto-approval

- Invoice scan approval.
- Menu scan approval.
- Payroll readiness approval.
- Daily Close signoff.
- Financial report approval/export signoff.
- Plan/billing changes.
- Firebase, App Check, MFA, Security Center, Backup Center, System Administrator, or rules changes.
- Integrations, OAuth, provider setup, POS/accounting/payroll keys, or provider secrets.
- Direct inventory quantity edits from “86 item” or “we're out of item” wording.

## Undo limits

Voice undo only rolls back recent safe voice actions where the app has enough previous state to restore or delete the voice-created record. It does not undo manager approvals, invoice approvals, menu scan approvals, financial signoffs, payroll actions, admin/security changes, integration changes, or older actions.
