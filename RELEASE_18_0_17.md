# Mobile 18.0.17

Release-gate navigation now checks rendered route content instead of shell titles, refuses pending lazy sections and administrator verification, and reports an explicit readiness failure at the existing deadline. Nested route resets wait for the actual surface before probing controls. Firebase coherence checks report HTTP document failures directly, and the local identity guard logs its refusal reason while retaining strict source checks. The lazy loading status is announced accessibly.

The preceding 18.0.16 full run completed with 713 passes, 22 failures, 8 skips and successful QA cleanup. Its source commit/hash remained identical at start and end; saved evidence includes a transient source-guard HTTP 503. These changes do not certify that those failures are fixed until the targeted/delta and subsequent full gates execute.

Production Firebase cheers-34b8d, production API destinations and retained APK signing remain required. Web17 remains separate. Connected-phone acceptance is excluded at Geoff's request. All tests/builds run locally; Playwright runs in visible PowerShell. GitHub Actions remains unauthorized.
