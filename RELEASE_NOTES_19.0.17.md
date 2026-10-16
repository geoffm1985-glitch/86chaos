# 86 Chaos 19.0.17 — Phase 1 preview

## Candidate 19.0.17: acknowledge the initial emulator listen session

19.0.16 deployed targeted passed 168 selected: 155 passed, 13 intentional skips,
zero failures/timeouts/flaky/unrun; all original 84 Phase 1 workflows and QA cleanup
passed. Local targeted failed: 174 selected, one passed, three ordinary failures,
zero test timeouts/flaky/intentional skips, 170 unrun. Its authoritative QA cleanup
passed; all tests and cleanup exited. Canonical reports/media, clean start/end
source, verified hash chain and original failure are preserved outside the source.
No delta ran; 19.0.16 is not accepted.

Actual failed-run network captures show the first addTarget(2) is sent without a
SID. Its HTTP 200 length-prefixed connect frame assigns a SID; subsequent commands
and removeTarget(2) use that assigned SID and are acknowledged HTTP 200. The 16
fixture incorrectly kept the initial target under an empty SID. All three failed
traces include that phantom target; the first also reports login readiness failure,
so its original result remains failed rather than being retroactively dismissed.

17 maps provisional targets only through the actual acknowledged connect frame.
Later removals cannot be resurrected if response-body delivery races them; distinct
channels with the same target ID remain isolated. Missing, malformed or ambiguous
handshakes and non-200 acknowledgments remain fatal. All source lifecycle guards,
business assertions, timeouts, case inventories and runtime classifications stay.

Three sanitized captured-protocol replays, delayed-body/removal ordering, overlapping
channels and malformed-handshake regressions faithfully failed before the fix:
six pass/six fail. Corrected tracker passed all 12 checks. New real client-SDK
contracts exercise acknowledged initial watch/unsubscribe on Chromium, mobile
Chromium, Edge, Firefox, WebKit and mobile WebKit using owned demo Auth/Firestore
records, with required record/Auth/SDK/browser/server cleanup. Scoped preflight
(140 Node + six SDK/browser contracts + 21 React + three real Firestore scenarios),
seal, signed production APK and exact deployed/local targeted/delta acceptance are
pending. No full gate or production deployment. Native backend/device/real Safari
acceptance remains deferred.

19.0.17 scoped preflight `phase1-component-20261016-102745` completed at 2026-10-16T15:32:06Z: 140 Node checks, six actual authenticated SDK/browser watch/unsubscribe contracts, 21 React tests and three real Firestore scenarios passed; zero failures/skips. Owned Auth/Firestore records, SDK/browser/server shutdown, isolated Firestore/hub/logging shutdown and all validation process exits were verified. Source tested before final documentation was `f0aee145f70b451b3694af32e8bfb4400a16736efcd9fc6089e79099961d3884`; the final manifest includes these evidence notes. Signed APK and exact deployed/local targeted/delta acceptance remain pending.
