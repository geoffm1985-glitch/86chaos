# 86 Chaos 13.1.21 Release Notes

## Employee Time Clock loading label fix

This release fixes the temporary reversed loading labels on employee punch actions.

### Fixed

- Clicking **Clock In** no longer briefly displays **CLOCKING OUT...** while the app saves the punch.
- Clicking **Clock Out** no longer briefly displays **CLOCKING IN...** while the app saves the punch.
- The button state now tracks the active punch action separately from the saved punch record, preventing the UI from crossing wires during fast state updates.
- The older schedule component copy was patched with the same guard so both schedule paths stay consistent.

### Deployment

No Firebase rules, Storage rules, Vercel config, or API route changes are required.
