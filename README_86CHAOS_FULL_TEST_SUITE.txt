86 Chaos full local test-suite runner v4

Copy these files into your app folder:
C:\Users\geoff\Documents\GitHub\86chaos

Files:
- RUN_86CHAOS_FULL_TEST_SUITE.cmd
- RUN_86CHAOS_FULL_TEST_SUITE.ps1
- README_86CHAOS_FULL_TEST_SUITE.txt

Run:
cd "$env:USERPROFILE\Documents\GitHub\86chaos"
.\RUN_86CHAOS_FULL_TEST_SUITE.cmd

Optional:
.\RUN_86CHAOS_FULL_TEST_SUITE.cmd -FailedOnlyReleaseGate
.\RUN_86CHAOS_FULL_TEST_SUITE.cmd -IncludeReleaseGate
.\RUN_86CHAOS_FULL_TEST_SUITE.cmd -SkipInstall

This version fixes PowerShell 5 parser errors and always creates an uploadable ZIP:
86chaos-full-local-suite-UPLOAD-ME-<runId>.zip
