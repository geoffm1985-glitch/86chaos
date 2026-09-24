# 86 Chaos 17.1.7

## 86Voice Mobile Toolbar Interaction Repair

17.1.7 is a focused repair for the reported dead mobile microphone button. It preserves the Concept 1 redesign and the 17.1.6 release-gate repairs while replacing the fragile mobile overlay architecture.

### Repairs

- Makes Voice the actual first button inside the mobile bottom navigation instead of using an empty placeholder underneath a separate floating control.
- Wires the toolbar button directly to the mounted 86Voice controller through an imperative ref so the tap reaches the voice start path synchronously.
- Removes the legacy floating microphone from the mobile tap path so it cannot overlap, swallow, or miss toolbar touches.
- Requests microphone access through `navigator.mediaDevices.getUserMedia()` before starting browser speech recognition, then immediately releases the probe track.
- Keeps the 86Voice panel visible when speech is unsupported or microphone permission is blocked so a tap never silently does nothing.
- Adds deployed browser coverage that verifies the first toolbar button opens 86Voice, requests microphone access, releases the probe track, and starts recognition.
- Updates older toolbar regressions to follow the real mobile Voice button instead of the retired placeholder/overlay implementation.

### Preserved

- Time Clock & Schedule remains the first primary application tab.
- Existing 86 Chaos icon and wordmark remain unchanged.
- Concept 1 page/subpage redesign remains intact.
- 17.1.6 Spanish and Schedule Builder release-gate repairs remain intact.
- Orders & Tickets remains absent.

### Certification status

This package is not certified until it is deployed to `testing.86chaos.com` and the release gate passes against the deployed 17.1.7 build.
