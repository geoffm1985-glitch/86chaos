# QA 13.1.30 - Live Activity Server Heartbeat

## Required setup
- Deploy to Vercel Preview.
- Confirm Preview Vercel environment variables point to the same Firebase project used by the preview app.
- Publish the included `firestore.rules` to that same Firebase project.

## Staff roster test
1. Log into the preview app on a phone as a regular staff test account.
2. Open Staff Roster.
3. Wait 30 seconds.
4. Confirm the My Live Presence Check panel says the heartbeat saved through the API or fallback.
5. Confirm the signed-in test account shows Online now and does not fall back to a days-old timestamp.

## Administrator Live Activity test
1. Keep the phone logged into the regular staff account.
2. On a laptop, log into the same preview deployment as Super Admin.
3. Open System Administrator -> Live Activity.
4. Confirm the regular staff account appears as online within the live window.
5. Confirm the online count includes the staff account, not only the Super Admin account.

## Failure clues
- If My Live Presence Check says the API failed, verify `FIREBASE_SERVICE_ACCOUNT_KEY` or the split Firebase Admin variables on Vercel Preview.
- If the API succeeds but Super Admin cannot see users, publish the included Firestore rules and log out/in.
- If Preview and Production Firebase variables are mixed, the phone may write to one Firebase project while the laptop reads another.
