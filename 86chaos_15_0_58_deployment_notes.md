# 86 Chaos 15.0.58 Deployment Notes

## Deploy target

Deploy this ZIP to the testing/Vercel preview branch first. Do not promote directly to production until the QA checklist has been run with real owner/admin/staff accounts.

## Vercel environment variables

No new Vercel environment variables are required for this release.

The working Firebase Admin setup is still supported:

- `FIREBASE_SERVICE_ACCOUNT_KEY` containing the full Firebase service account JSON
- `CRON_SECRET`

Do not add a production Firebase key to the testing side unless you intentionally split testing and production Vercel environments later.

## Firebase rules

No new Firestore or Storage rule changes were made in 15.0.58 compared with 15.0.57.

Important: if the target Firebase project has not yet received the 15.0.54+ rules, publish the included latest `firestore.rules` and `storage.rules` to the testing Firebase project before relying on plan gates and protected collections.

Recommended testing flow:

1. Deploy the app ZIP to the testing branch.
2. Confirm Vercel build completes.
3. Log in as owner/admin/staff test accounts.
4. Validate feature gates and locked direct routes.
5. Test plan-sensitive collections through normal UI flows.
6. Use Firebase Rules Playground for staff-denied financial/inventory/menu intelligence reads if needed.
7. Promote only after the preview behaves cleanly.

## Intentionally still placeholders

- Live Stripe billing is not implemented.
- Live POS/accounting OAuth is not implemented.
- Customer-facing provider API key setup is not exposed.
- Integrations remain locked for customer tiers and are described as coming soon.

## Rollback

If preview testing finds a regression, roll back to the previous successful 15.0.57 deployment. This release does not require a schema migration, so rollback should not require data repair.
