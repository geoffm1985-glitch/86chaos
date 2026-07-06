# QA Checklist - 86 Chaos 13.1.19

## Deploy and rules
- Deploy the app through GitHub/Vercel.
- Publish the included `firestore.rules` in Firebase.
- Publish the included `storage.rules` in Firebase.
- Confirm Vercel has either `FIREBASE_SERVICE_ACCOUNT_KEY` or the split Firebase Admin env vars.
- Redeploy Vercel after confirming env vars.

## Live Activity / Recent Activity
- Log in as a normal Cheers Chilton employee.
- Wait at least 25 seconds with the app open.
- Log in as Super Admin and open System Administrator → Live Activity.
- Confirm the active employee appears in Live Activity within the live window.
- Close the employee tab or wait several minutes.
- Confirm the user falls back into Recent Activity instead of disappearing completely.
- If the panel shows a Firestore warning, publish the included rules and log out/in again.

## Push notifications
- Log in as a normal user in a supported browser.
- Allow notifications when prompted.
- Log out and back in once to verify token resync works for already-approved permission.
- In System Administrator → Platform Operations, run Test Push Notifications.
- Confirm at least one eligible device receives the notification.
- Confirm `/api/send-push` rejects callers from another workspace.

## Voice 86 alert
- Open the microphone.
- Say “86 ranch.”
- Confirm an important 86 alert appears on the Message Board.
- Confirm inventory stock for ranch is not changed.
- Repeat with “we’re out of fries.”
- Confirm the alert is posted and inventory is still untouched.

## Review Stamps
- Open System Administrator → Platform Operations.
- Use Create Review Stamp.
- Open System Administrator → Forensics & Backups.
- Confirm the latest review stamp details are visible under Review Stamps.
- Confirm recent stamp audit entries appear when available.

## Maintenance lockout wording
- In System Administrator → Workspaces, set a test workspace to Maintenance Lock.
- Log in as a normal user for that workspace.
- Confirm the screen says Down for Maintenance and does not mention subscription or billing issues.
- Unlock the workspace and confirm normal access returns.

## Administrator layout
- Open System Administrator.
- Confirm tabs are grouped into Overview, Customer Operations, Support & Safety, and Reference.
- Confirm the Command Deck jump buttons still navigate to the right grouped section.
- Confirm Admin Manual search includes the updated section names.
