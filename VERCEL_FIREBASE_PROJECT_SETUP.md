# Super-Easy Vercel Firebase Project Setup

## Why this is needed

The testing website signs users in through `chaos-test-d1601`. Production signs users in through `cheers-34b8d`.

AI page limits are enforced by the server with Firestore transactions. The matching Firebase service-account key must therefore exist in each Vercel environment.

## Preview / testing

In Vercel, add these variables to the **Preview** environment:

```text
FIREBASE_TEST_SERVICE_ACCOUNT_KEY
MASTER_ADMIN_EMAIL=geoffm1985@gmail.com
MASTER_ADMIN_EMAILS=geoffm1985@gmail.com
```

Paste the full service-account JSON from `chaos-test-d1601` into `FIREBASE_TEST_SERVICE_ACCOUNT_KEY`.

Optional testing bucket override:

```text
FIREBASE_TEST_STORAGE_BUCKET=chaos-test-d1601.firebasestorage.app
```

## Production

In Vercel, add these variables to the **Production** environment:

```text
FIREBASE_PRODUCTION_SERVICE_ACCOUNT_KEY
MASTER_ADMIN_EMAIL=geoffm1985@gmail.com
MASTER_ADMIN_EMAILS=geoffm1985@gmail.com
```

Paste the full service-account JSON from `cheers-34b8d` into `FIREBASE_PRODUCTION_SERVICE_ACCOUNT_KEY`.

Optional production bucket override:

```text
FIREBASE_PRODUCTION_STORAGE_BUCKET=cheers-34b8d.firebasestorage.app
```

`REACT_APP_MASTER_ADMIN_EMAIL` may be used by the frontend for display awareness only. The server never trusts it for bypass access.

## Deploy steps for 15.0.49

1. Redeploy the testing branch in Vercel.
2. Publish the included `firestore.rules` to `chaos-test-d1601`. This prevents browser clients from editing `aiUsage` counters or limits.
3. Test page limits in Preview.
4. After testing, deploy the app and the same Firestore rules to production.

No Storage rules, Firestore indexes, or Firebase Functions changes are required for 15.0.49.

## Backward compatibility

`FIREBASE_SERVICE_ACCOUNT_KEY` still works only when the JSON belongs to the same Firebase project as the signed user token. Project-specific names are safer.

## Never do this

- Do not put service-account JSON in GitHub.
- Do not place it in a `REACT_APP_...` variable.
- Do not paste it into browser code.
- Do not use the production key for testing.
- Do not give customers write access to `aiUsage`.
