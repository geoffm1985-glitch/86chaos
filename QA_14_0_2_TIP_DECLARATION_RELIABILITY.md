# QA Checklist: 86 Chaos 14.0.2 Tip Declaration Reliability

## Version

- [ ] Confirm `public/version.json` reports `14.0.2`.
- [ ] Confirm the app update banner clears after refresh.

## Settings

- [ ] Open Settings → Workspace → Labor & Payroll.
- [ ] Confirm Mandatory Tip Declaration is visible and not locked by plan tier.
- [ ] Turn Mandatory Tip Declaration on and save.
- [ ] Refresh the app and confirm the setting remains on.
- [ ] Turn it off, save, refresh, and confirm clock-out can skip the declaration modal.
- [ ] Turn it back on before final production testing.

## Employee clock-out

- [ ] Log in as a regular employee.
- [ ] Clock in.
- [ ] Clock out with Mandatory Tip Declaration enabled.
- [ ] Confirm the Declare Tips modal appears before the punch closes.
- [ ] Enter `0` cash and `0` credit tips and finalize.
- [ ] Confirm the punch closes successfully.
- [ ] Clock in again, then clock out with cash and credit tips entered.
- [ ] Confirm the values appear in Financials → Timesheets → Tips and exports.

## Legacy workspace behavior

- [ ] Run System Administrator → 14.0 Robustness Suite → Schema Doctor dry run.
- [ ] Confirm a workspace missing `systemSettings.tips` is flagged as repairable.
- [ ] Run repair only after confirming the target workspace.
- [ ] Confirm the workspace settings now include `tips: true`.

## Regression checks

- [ ] Confirm unpaid break buttons still respect the workspace Breaks setting.
- [ ] Confirm geofence clock-in/clock-out still uses the workspace settings.
- [ ] Confirm manager punch edits can still update cash and credit tips.
- [ ] Confirm payroll CSV exports include declared tips.
