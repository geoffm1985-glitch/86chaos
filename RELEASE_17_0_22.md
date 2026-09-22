# 86 Chaos 17.0.22

## Release Gate Top-Level Layout Smoke Repair

The 17.0.21 full Play Store gate proved that removing the extra watchdog was insufficient: the locked Playwright CLI still produced no output when launched from the synchronous Node readiness runner and timed out after 180 seconds. Every earlier readiness check passed.

17.0.22 removes browser execution from that synchronous Node runner. The same required five-case layout suite now runs as a live top-level PowerShell gate step through the already-verified local `playwright.cmd`, matching the launch boundary used by the main Playwright release gate. The layout config keeps one worker and adds a 180-second Playwright global limit. A failure still blocks the main suite and remains visible in the current-run step log.

Application behavior, Schedule Builder, schedule publishing, POS Bridge, Firebase rules, permissions, and restaurant data paths are unchanged.
