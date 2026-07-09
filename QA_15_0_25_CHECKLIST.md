# QA Checklist - 86 Chaos 15.0.25 Account Repair + Verification Debug

## Version
- [ ] `/version.json` shows `15.0.25`.
- [ ] Settings > Account Security opens without console errors.

## Account Security diagnostics
- [ ] Account Security shows Browser Project and API/Admin Project.
- [ ] Browser Project and API/Admin Project match the intended Firebase project for the deployment.
- [ ] Auth UID and Auth Email match the Firebase Authentication user.
- [ ] Firestore Email and Workspace show when the user profile exists.
- [ ] If the Firestore profile is missing, the panel shows Profile Missing.

## Profile repair
- [ ] With a test Auth user missing `users/{uid}`, click Repair My User Profile.
- [ ] A `users/{uid}` document is created or refreshed without granting unintended elevated access.
- [ ] Refresh Status shows Profile Linked after repair.

## Verification rescue
- [ ] Click Send Verification Email and confirm the app reports success or a clear Firebase error.
- [ ] If no email arrives, click Generate Verification Link.
- [ ] Open the generated link, return to the app, and click Refresh Email Status.
- [ ] Email verified status changes to verified.

## MFA enrollment
- [ ] Use phone format like `+19205551234`.
- [ ] Send Setup Code is disabled until email is verified.
- [ ] After verification, Send Setup Code reaches Firebase MFA flow.
- [ ] MFA enforcement env vars remain `false` until a full fresh MFA login succeeds.

## Regression
- [ ] Reset Password still sends to the active Firebase Auth email.
- [ ] Profile Save still works.
- [ ] No Firestore or Storage rules needed publishing.
