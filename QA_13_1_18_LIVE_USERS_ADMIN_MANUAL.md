# QA 13.1.18: Live Users + Admin Manual

## Live Users
1. Deploy this build and publish the updated firestore.rules.
2. Log in as a normal employee on another browser/device.
3. Wait 25 to 60 seconds.
4. Log in as platform admin.
5. Open System Administrator → Live Users.
6. Confirm the employee appears under Live Users Now.
7. Confirm the row shows workspace, role, active tab, last-seen text, email, and device.
8. Put the employee browser in the background and wait.
9. Confirm the status eventually leaves Live Users and appears in Recent Activity Buffer.
10. Check browser console for no permission-denied heartbeat errors.

## Firestore Rules
1. Confirm userSafeSelfUpdate allows only safe profile/presence fields.
2. Confirm normal users cannot change restaurantId, isSuperAdmin, billingStatus, planType, or systemAccess.
3. Confirm normal users can update their own lastActive/lastHeartbeatAt/onlineState fields.

## Administrator Manual
1. Open System Administrator → Admin Manual.
2. Search “tab map”.
3. Confirm the manual explains every System Administrator section.
4. Search “Live Users”.
5. Confirm it explains heartbeat/presence troubleshooting.
6. Search “Operations”.
7. Confirm every Operations option is described.
8. Open Help Center and search 13.1.18.
9. Confirm Help Center release notes are generic and do not expose administrator-tab details.
