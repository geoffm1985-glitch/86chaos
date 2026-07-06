# 86 Chaos 13.1.20 Release Notes

## Employee Time Clock button refresh fix

This release fixes the employee punch button not switching automatically after clock actions.

### What changed

- Clock In now immediately flips the visible employee action to Clock Out after the punch is saved.
- Clock Out now immediately flips the visible employee action back to Clock In after the punch-out is confirmed/finalized.
- Added a safe busy state so employees cannot double-tap Clock In or Clock Out while the write is processing.
- Simplified the active-punch listener to avoid a fragile Firestore `status in [...]` query.
- Added optimistic guards so a stale snapshot cannot erase the button state right after a punch action.

### Deployment impact

- No Firestore rule changes required.
- No Storage rule changes required.
- No Vercel environment variable changes required.
