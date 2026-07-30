86 CHAOS TESTS-ONLY RUNNER

These files can be copied into the 86chaos app root and run with one command.

Run from:
C:\Users\geoff\Documents\GitHub\86chaos

Command:
.\RUN_86CHAOS_FULL_TEST_SUITE.cmd

What changed in this runner:
- It checks the project Node requirement before npm ci, so Node 22/old Node fails with a clear message instead of a confusing dependency-install error.
- It uses npm ci --include=dev --no-audit --no-fund.
- It prints the last log lines when a required step fails.
- It writes logs to test-results/86chaos-full-local-suite/<runId>/.

Optional:
.\RUN_86CHAOS_FULL_TEST_SUITE.cmd -FailedOnlyReleaseGate
.\RUN_86CHAOS_FULL_TEST_SUITE.cmd -IncludeReleaseGate
.\RUN_86CHAOS_FULL_TEST_SUITE.cmd -SkipInstall

Note:
86 Chaos release validation requires Node 24.x.
