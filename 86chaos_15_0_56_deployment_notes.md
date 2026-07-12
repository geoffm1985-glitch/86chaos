# 86 Chaos 15.0.56 Deployment Notes

## Firebase rules

No Firestore or Storage rules changes are required for this release.

## Vercel environment variables

No new Vercel secrets are required.

Testing/preview can continue using the existing setup:

```text
FIREBASE_SERVICE_ACCOUNT_KEY
CRON_SECRET
```

`FIREBASE_SERVICE_ACCOUNT_KEY` should remain the full Firebase service account JSON.

## Build environment

A non-secret root `.env` is included:

```text
DISABLE_ESLINT_PLUGIN=true
GENERATE_SOURCEMAP=false
```

This prevents production build lint hangs in the large CRA app and keeps bundles smaller by skipping sourcemaps. It does not change runtime Firebase, push, billing, plan gate, or feature behavior.

## Deployment path

1. Commit and push the full ZIP contents to the testing branch.
2. Let Vercel build the testing preview.
3. Verify one-workspace push, restaurant-group push, stale-token repair, and audit logs.
4. Promote to production only after preview testing passes.

## Placeholder status

Still intentionally not implemented/unlocked:

- Live Stripe billing.
- Live POS integrations.
- Customer-facing OAuth/provider setup.
- Customer-facing API key storage for integrations.
