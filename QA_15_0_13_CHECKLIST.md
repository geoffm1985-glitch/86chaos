# QA Checklist: 86 Chaos 15.0.13

## Shared reminders
- [ ] Open My Reminders as a manager.
- [ ] Create a reminder for yourself with Share With = Just me.
- [ ] Create a reminder assigned to another team member.
- [ ] Confirm the creator can see/edit/delete the shared reminder.
- [ ] Log in as the assigned teammate and confirm the shared reminder appears.
- [ ] Mark the shared reminder done as the assigned teammate.
- [ ] Confirm reminder push dispatch goes to the assigned teammate when due.

## Firestore rules
- [ ] Publish the included `firestore.rules` to testing Firebase.
- [ ] Test shared reminder create/read/update/delete permissions.
- [ ] Publish the same rules to production Firebase after testing passes.

## Storage rules
- [ ] Publish the included `storage.rules` to testing Firebase.
- [ ] Upload a menu from Menu Intelligence and confirm it succeeds.
- [ ] Upload an invoice from Invoice Scanner and confirm it succeeds.
- [ ] Try uploading a scan file from the wrong path/purpose and confirm it is blocked.
- [ ] Publish Storage rules to production after testing passes.

## Security Center
- [ ] Open System Administrator → Security Center.
- [ ] Press Refresh Security Center.
- [ ] Confirm env var statuses appear.
- [ ] Confirm risky elevated users missing MFA flags appear.
- [ ] Confirm suspicious activity panel loads.
- [ ] Confirm Firestore/Storage rule version fields show 15.0.13 or publish-date-needed.

## Rate limiting
- [ ] Run a normal menu scan.
- [ ] Run a normal invoice scan.
- [ ] Send a push test.
- [ ] Confirm normal use does not hit rate limits.
- [ ] Optionally lower a route limit env var temporarily and confirm a friendly 429 appears.

## App Check / MFA setup
- [ ] Confirm preview/testing Vercel uses the testing Firebase project and production Vercel uses the production Firebase project.
- [ ] Add `REACT_APP_FIREBASE_APPCHECK_SITE_KEY` to Vercel preview/testing first.
- [ ] Enable App Check in Firebase Console for the testing project.
- [ ] Confirm Security Center sees App Check headers/status.
- [ ] Configure MFA/two-step policy for elevated users in Firebase Authentication / Identity Platform.
- [ ] Repeat App Check and MFA setup separately for production.

## Professional UI polish smoke test
- [ ] Check mobile My Reminders layout.
- [ ] Check System Administrator section picker groups.
- [ ] Check Security Center on mobile.
- [ ] Confirm buttons remain tappable and overlays are not clipped.

## Build/deploy
- [ ] Confirm `/version.json` shows 15.0.13.
- [ ] Confirm Vercel deployed API route changes.
- [ ] Confirm no old release-note files are included in the ZIP.
