# 86 Chaos 17.0.18

## Release Gate Schedule Subprocess Timeout Repair

This release changes the release-gate harness only. Application behavior, Schedule Builder behavior, schedule publishing, Firebase rules, and production data paths are unchanged from 17.0.17.

The 17.0.17 full Play Store run proved the schedule publication Node tests and React UI tests passed, then stalled while a second nested npm lifecycle attempted to launch the five-test mobile layout Playwright suite. The outer observable runner correctly timed out after 900 seconds, but failure extraction then selected the harmless TAP summary `fail 0` instead of the timeout.

17.0.18 splits those concerns. The release-gate local-readiness phase runs the schedule publication Node/React checks through `test:schedule-publish:core`, then launches the mobile layout smoke as its own observable step directly through the installed `@playwright/test` CLI. The normal developer command `npm run test:schedule-publish` still runs both pieces.

Failure extraction now treats exit code 124 as authoritative timeout evidence before parsing TAP output, preventing passing summary text from becoming the reported blocker.
