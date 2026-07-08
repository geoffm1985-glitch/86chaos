# 86 Chaos

Current version: 15.0.3

86 Chaos is a restaurant/kitchen management web app built with React, Vite-compatible structure, Firebase, and Vercel serverless API routes.

## 15.0.3 focus

This build keeps the 15.0.2 stability/cost-control work intact, then cleans up noisy bulk Inventory notifications:

- Invoice approval now silences the internal per-row Safe Write toasts.
- Approving a scanned invoice shows one `Invoice Processed` notification with the total saved item count, including updated and newly added inventory items.
- CSV inventory import now uses the same quiet bulk-save behavior and shows one `Upload Complete` summary.
- Ordinary one-off Inventory saves still show their normal confirmation notifications.
- Firestore rules, Storage rules, Vercel config, and environment variables are unchanged from 15.0.2.

## Deploy steps

1. Deploy the app through GitHub/Vercel.
2. Confirm `/version.json` reports `15.0.3` after deploy.
3. Test invoice approval with multiple rows and confirm only one summary notification appears.
4. Test CSV inventory import with multiple rows and confirm only one summary notification appears.
5. Run the 15.0.3 QA checklist before handing it to staff.

## Required separate publishes

- Firestore rules: no new changes from 15.0.2.
- Storage rules: no new changes from 15.0.2.
- Vercel deploy/API routes: yes, deploy the updated app code.
- New environment variables: no.

## Branding rule

86 Chaos branding is mandatory and must always remain visible. Restaurant/customer logos may display beside it, but cannot replace or hide 86 Chaos branding.
