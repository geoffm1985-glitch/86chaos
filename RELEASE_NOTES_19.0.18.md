# 86 Chaos 19.0.18 - Phase 1 preview

## Candidate 19.0.18: release real local listener targets before offline faults

19.0.17 deployed targeted passed: 168 selected, 155 passed, 13 intentional skips,
zero failures/timeouts/flaky/unrun; all 84 original Phase 1 workflows and cleanup
passed. Local targeted failed: 174 selected, 36 passed, three ordinary failures,
one intentional skip, 134 unrun; zero test timeouts/flaky. Its authoritative QA
cleanup passed. Canonical reports/media, exact clean start/end source and final
hash chain are preserved. No delta ran and 17 remains unaccepted.

Actual failed traces show offline reconnects abandon previously accepted watch
targets. An isolated official-emulator control left 12 targets and queued 485 more
messages after 20 writes. An experimental close-callback shadow jar only halved
the leak and was rejected; the official emulator remains unchanged. Public SDK
unsubscribe/HTTP200-remove acknowledgment before offline, then resubscribe to the
same references/callbacks, produced zero orphan targets and zero message growth
on all six browser configurations, with owned cleanup and all process exits.
The first standalone WebKit fixture omitted the app's existing transport selector
and also failed reattachment while online. Both WebKit controls passed with the
actual existing forced-long-polling/XHR selector; the original failure is retained.

18 tracks public onSnapshot subscriptions only on fail-closed loopback/demo mode.
The local fixture settles writes, pauses real subscriptions without unmounting
React, waits original-limit removeTarget HTTP200 acknowledgments, performs the
same offline toggle, then resumes identical callbacks/options. Live/native paths
retain the original SDK function. Explicit read-listen fault setup drains existing
targets before installing the original abort. Only the exact successful fixture
abort of add-only read commands can discard never-accepted adds. Unknown aborts,
non-200 replies, malformed/ambiguous handshakes and every unacknowledged removal
remain fatal; later successful commands cannot be erased by earlier aborts.

Seven registry/lifecycle and seven strict-abort regressions passed with the 12
existing protocol guards (26 total). Both local functional/canonical lifecycle
contracts now verify actual offline invalidation and authoritative restoration
before their existing reload checks across six engines. All 84 original business
identities/assertions/timeouts remain unchanged; the inventory remains 96 Phase 1
identities, deployed 168/local 174 selected. Real SDK preflight loads the actual
candidate registry and existing canonical transport selector in all six engines.
Full scoped preflight (154 Node, six real SDK/browser contracts, 21 React and three
real Firestore scenarios), seal, signed production APK, testing release and exact
deployed/local/delta acceptance are pending. No full gate or production deployment.
Native backend/device and real Safari acceptance remains deferred.

19.0.18 scoped preflight `phase1-component-20261016-143458` completed at 2026-10-16T19:39:37Z: 154 Node checks, six actual authenticated SDK/browser registry watch/pause/offline/resume contracts, 21 React tests and three real Firestore scenarios passed; zero failures/skips. Owned Auth/Firestore records, SDK/browser/server cleanup, isolated Firestore/hub/logging shutdown and all validation process exits were verified. Source tested before final documentation was `0e402506d4c8fe9a7ae76682121ed7a699a08ae8235ed8677a716abc2f189677`; the final manifest includes these evidence notes. Signed APK and exact deployed/local targeted/delta acceptance remain pending.
