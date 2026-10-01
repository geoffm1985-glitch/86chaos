# 86 Chaos 17.0.53

## Release Gate State Isolation and Schedule Reliability Repair

This testing-branch build repairs the independent defects exposed by the 17.0.52 failed+new gate and removes the cascade of false failures that followed the Spanish interface probe.

### Runtime repairs
- Same-tab language saves now propagate into the active I18n provider without waiting for a reload or remote listener round-trip.
- Schedule Builder availability reads no longer add a server-side employee-name ordering requirement. The tenant-scoped records are sorted in the browser after a successful read.
- On mobile and compact widths, the tall Schedule Builder control deck scrolls away while the day/date header remains sticky below the app header.

### Release-gate repairs
- The Spanish interface probe normalizes the shared QA identity to English before the test and restores English in its finally block.
- Ghost Mode and System Administrator tests match the rendered button controls even when accessible names are decorated with an Open prefix.
- The historical 17.0.49 deployment-reader test verifies the current 17.x package instead of pinning the live build to 17.0.49.
- Permission-gate detection now matches actual gate copy rather than any incidental not available phrase.
- The Support Diagnostics cost probe avoids a strict-mode duplicate locator.
- The over-coverage fixture now uses two distinct bartenders, matching the app's employee-identity de-duplication rules.

No production push is included in this build.
