# QA Checklist: 13.1.21 Time Clock Loading Labels

## Employee punch-in

- Log in as a regular employee, not Super Admin.
- Open **Time Clock & Schedule → My Schedule**.
- Click **Clock In**.
- Confirm the button shows **CLOCKING IN...** while saving.
- Confirm it changes to **CLOCK OUT** after the save completes without refreshing.
- Confirm it does not briefly show **CLOCKING OUT...** during punch-in.

## Employee punch-out

- While clocked in, click **Clock Out**.
- If tips are enabled, complete the tip modal and click **Finalize Clock Out**.
- Confirm the button shows **CLOCKING OUT...** while saving.
- Confirm it changes to **CLOCK IN** after the save completes without refreshing.
- Confirm it does not briefly show **CLOCKING IN...** during punch-out.

## Regression checks

- Confirm double-clicking is still blocked while a punch action is saving.
- Confirm the active punch still appears in Financials / Timesheets after clock-in.
- Confirm the completed punch appears after clock-out.
- Confirm no refresh is required for either button flip.
