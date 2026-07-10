# Super-Easy Vercel Firebase Setup for 15.0.47

## Why this is needed

The testing website signs users in through `chaos-test-d1601`. Production signs users in through `cheers-34b8d`.

A server route that sends push notifications, reads Firestore, manages users, creates backups, or reads private Storage files needs a service-account key for the same project.

## Preview / testing

In Vercel, add this variable to the **Preview** environment only:

```text
FIREBASE_TEST_SERVICE_ACCOUNT_KEY
```

Paste the full service-account JSON from the `chaos-test-d1601` Firebase/Google Cloud project.

Optional testing bucket override:

```text
FIREBASE_TEST_STORAGE_BUCKET=chaos-test-d1601.firebasestorage.app
```

## Production

In Vercel, add this variable to the **Production** environment only:

```text
FIREBASE_PRODUCTION_SERVICE_ACCOUNT_KEY
```

Paste the full service-account JSON from the `cheers-34b8d` project.

Optional production bucket override:

```text
FIREBASE_PRODUCTION_STORAGE_BUCKET=cheers-34b8d.firebasestorage.app
```

## Then

Redeploy the testing branch. No Firebase rules or Functions deployment is needed for 15.0.47.

## Backward compatibility

`FIREBASE_SERVICE_ACCOUNT_KEY` still works, but only when the JSON inside it belongs to the same Firebase project as the signed user's token. Project-specific names are safer because Vercel cannot accidentally use the production key for Preview.

## Never do this

- Do not put service-account JSON in GitHub.
- Do not place it in a `REACT_APP_...` variable.
- Do not paste it into browser code.
- Do not use the production key for testing.
