# QA Checklist — 86 Chaos 13.1.28 Live Presence & Test Push

## Required deploy step
- [ ] Deploy the Vercel Preview build.
- [ ] Publish the included `firestore.rules` to the Firebase project used by that Preview build.
- [ ] Log out and back in on both devices after deploy/rules publish.

## Staff Roster live presence
- [ ] Log in on a phone as a regular staff/test account.
- [ ] Keep the app open on the phone for at least 30 seconds.
- [ ] Log in on a laptop as admin/manager.
- [ ] Open Staff Roster.
- [ ] Confirm the phone user shows `Online now` or a fresh minute-level last-active time.
- [ ] Confirm the user does not briefly flash online and then return to an old multi-day timestamp.
- [ ] Background or close the phone app and confirm the status eventually ages out instead of staying permanently online.

## System Administrator live activity
- [ ] Log in as Super Admin.
- [ ] Open System Administrator → Live Activity.
- [ ] Confirm the phone user appears in Live Activity within the live window.
- [ ] Confirm Recent Activity uses fresh presence when the user falls outside the live window.

## Staff permissions
- [ ] Log in as regular staff.
- [ ] Confirm Staff Roster is visible.
- [ ] Confirm add/edit/reset/delete staff controls are hidden.
- [ ] Log in as manager/admin.
- [ ] Confirm staff management controls still appear.

## Test push wording
- [ ] From System Administrator → Platform Operations, send Test Push Notifications.
- [ ] Confirm the received notification title is `86 Chaos Test Notification`.
- [ ] Confirm the body says it is only a test and that no schedule was published.

## Regression smoke test
- [ ] Confirm login works on the Preview URL.
- [ ] Confirm Today, Published Schedule, Staff Roster, Settings, and System Administrator still load.


## Global lockdown behavior
- [ ] As Super Admin, run Global Lockdown from System Administrator → Platform Operations.
- [ ] Confirm regular users in every workspace, including Cheers, see the Down for Maintenance screen.
- [ ] Confirm your Super Admin account can still enter the app while lockdown is active.
- [ ] Lift lockdown and confirm normal users can log in again.
