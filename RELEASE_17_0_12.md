# 86 Chaos 17.0.12

## Schedule Publish Candidate Parity and Firefox Gate Retry

This is a precision repair of the supplied 17.0.11 source. It changes only the two reported failure paths plus required version/test metadata.

### Schedule publishing

The browser readiness check could disagree with the server-authoritative identity check for already-published legacy shifts. In particular, the browser tolerated missing canonical `userId`, `authUid`, or `assignedUserId` aliases while the server correctly selected those shifts for identity repair. That made the server candidate set larger than the confirmed browser set and produced the reported `candidate_set_changed` message: “The saved schedule changed or the candidate query is incomplete.”

17.0.12 makes the browser identity readiness rule match the server rule exactly for those ID aliases. It also removes the browser-only name-field requirement that could create the opposite candidate-set mismatch. No Firestore schema, role logic, schedule dates, schedule rendering, printing, POS behavior, permissions, or publishing transaction semantics are changed.

### Firefox PWA release-gate failure

The supplied failed-test report contains one failure: Firefox PWA could not launch its browser process before the metadata test ran. 17.0.12 gives only the `firefox-pwa` project one bounded retry in both the full and failed-only Playwright configurations. The real Firefox browser test and all of its assertions remain unchanged. No retry behavior is added to Chromium, Edge, WebKit, or mobile WebKit.

### Validation

Targeted 17.0.12 regression tests cover the schedule candidate-parity case and verify the Firefox retry is isolated to that project. The release validator checks version wiring and both surgical fixes.
