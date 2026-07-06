# QA 13.1.29 - Live Activity Repair

## Required deploy steps
1. Deploy the app ZIP to the Vercel Preview environment.
2. Publish the included `firestore.rules` to the Firebase project used by that Preview environment.
3. Log out and back in on the admin laptop and the staff/test phone.

## Test: Staff Roster online status
1. Log into the phone as a regular staff/test account.
2. Leave 86 Chaos open for 30 seconds.
3. On the laptop, open Staff Roster.
4. Confirm the phone account shows `Online now` and does not fall back to an old multi-day timestamp.

## Test: System Administrator Live Activity
1. On the laptop, open System Administrator → Live Activity.
2. Confirm the Live Activity debug strip shows a nonzero Online count when the phone is open.
3. Confirm the phone account appears in Live Activity Now.
4. Confirm the row shows the correct workspace, role, active tab, and recent Seen time.

## Test: stale sessions do not win
1. Leave the phone open until at least two heartbeat cycles pass.
2. Refresh the laptop view.
3. Confirm the phone account stays online or shows a fresh minute-level timestamp.

## Failure clues
- If the user flashes online and disappears again, verify the deployed Firestore rules include the `livePresence` match block.
- If the debug strip shows Users but Online stays 0, check whether the phone is on the same Preview URL and Firebase project.
- If Firestore shows permission denied, confirm the phone user document `restaurantId` matches the workspace being viewed.
