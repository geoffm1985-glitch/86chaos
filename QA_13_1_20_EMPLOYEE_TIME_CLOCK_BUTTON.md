# QA Checklist: 13.1.20 Employee Time Clock Button

## Employee clock-in / clock-out state

- [ ] Log in as a regular non-admin employee.
- [ ] Open Time Clock & Schedule → My Schedule.
- [ ] Click Clock In.
- [ ] Confirm the button changes to Clock Out without refreshing the app.
- [ ] Confirm the punch appears in Financials → Timesheets as clocked in.
- [ ] Click Clock Out.
- [ ] If tips are enabled, complete the tip modal and click Finalize Clock Out.
- [ ] Confirm the button changes back to Clock In without refreshing the app.
- [ ] Confirm the punch has a clock-out time in Financials → Timesheets.

## Safety checks

- [ ] Try double-clicking Clock In quickly and confirm only one punch is created.
- [ ] Try double-clicking Clock Out quickly and confirm the punch is only finalized once.
- [ ] Test a user who is not scheduled today and confirm the unscheduled punch confirmation still appears.
- [ ] If geofence is enabled, confirm Clock In still blocks users outside the allowed area.
- [ ] If geofence review is triggered during Clock Out, confirm canceling the warning keeps the user clocked in.
- [ ] If geofence review is confirmed during Clock Out, confirm the button flips back to Clock In and the manager alert is posted.

## Regression checks

- [ ] Confirm admin users can still view/edit time punches in Financials.
- [ ] Confirm Schedule Builder still opens for users with schedule permission.
- [ ] Confirm Time Clock & Schedule still shows My Schedule, Full Schedule, Month View, Request Off, and Schedule Builder where permitted.
